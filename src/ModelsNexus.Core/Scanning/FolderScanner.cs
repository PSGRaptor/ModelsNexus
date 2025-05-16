// ============================================================================
// FILE:     /src/ModelsNexus.Core/Scanning/FolderScanner.cs
// PROJECT:  ModelsNexus.Core
// AUTHOR:   Models Nexus (MIT Licence)
// SUMMARY:  Recursively scans user-supplied directories for model artefacts
//           (.safetensors, .ckpt, .pt, LoRA derivatives) and emits a strongly-
//           typed result object containing metadata and hashes.
// ============================================================================

using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using ModelsNexus.Core.Hashing;

namespace ModelsNexus.Core.Scanning;

/// <summary>
/// A single record representing one model file discovered on disk.
/// </summary>
public sealed record ModelFileInfo(
    string   FullPath,
    long     SizeBytes,
    DateTime LastWriteUtc,
    string   Sha256,
    string   Blake3);

/// <summary>
/// Responsible for scanning one or more root folders (local or network UNC)
/// for Stable-Diffusion model artefacts. The scan is file-system I/O bound
/// *and* CPU-bound (hashing), so we use a producer/consumer pattern to keep
/// all cores busy without wasting IOPS.
/// </summary>
public sealed class FolderScanner
{
    // ------------------------------------------------------------------  FIELDS

    /// <summary>Extensions we consider model artefacts.</summary>
    private static readonly string[] _extensions =
    [
        ".safetensors", ".ckpt", ".pt",
        // LoRA derivatives
        ".lora", ".safetensorslora"
    ];

    // -----------------------------------------------------------------  METHODS

    /// <summary>
    /// Asynchronously scans <paramref name="rootPaths"/> and yields
    /// <see cref="ModelFileInfo"/> objects as soon as each file is processed.
    /// </summary>
    /// <remarks>
    /// <para>
    ///   The method is fully asynchronous and <b>lazy</b>. Callers can start
    ///   consuming results immediately (e.g., to update a progress bar) while
    ///   the scan continues in the background.
    /// </para>
    /// </remarks>
    public async IAsyncEnumerable<ModelFileInfo> ScanAsync(
        IEnumerable<string> rootPaths,
        [EnumeratorCancellation] CancellationToken cancel = default)
    {
        if (rootPaths is null) yield break;

        // Use a thread-safe queue so producer threads can push discovered files.
        var fileQueue = new ConcurrentQueue<string>();

        // 1. PRODUCER – enqueue file paths (I/O bound, so use Task.Run to avoid
        //    blocking the async state machine when running on UI thread).
        var producer = Task.Run(() =>
        {
            foreach (var root in rootPaths)
            {
                cancel.ThrowIfCancellationRequested();
                if (!Directory.Exists(root)) continue;

                foreach (var file in Directory.EnumerateFiles(
                             root, "*.*", SearchOption.AllDirectories))
                {
                    cancel.ThrowIfCancellationRequested();

                    if (_extensions.Any(ext =>
                            file.EndsWith(ext, StringComparison.OrdinalIgnoreCase)))
                    {
                        fileQueue.Enqueue(file);
                    }
                }
            }
        }, cancel);

        // 2. CONSUMERS – parallel compute hashes
        var workers = Enumerable.Range(0, Environment.ProcessorCount)
                                .Select(_ => Task.Run(ProcessQueue, cancel))
                                .ToArray();

        async Task ProcessQueue()
        {
            while (!cancel.IsCancellationRequested)
            {
                if (!fileQueue.TryDequeue(out var path))
                {
                    // When the producer finished and the queue drained, exit.
                    if (producer.IsCompleted)
                        break;

                    await Task.Delay(50, cancel); // back-off
                    continue;
                }

                try
                {
                    var fileInfo = await Task.Run(() => CreateInfo(path), cancel);
                    // Yield result through channel – here via async iterator
                    _ = Task.Run(() => channel.Writer.TryWrite(fileInfo), cancel);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    // Skip unreadable files; optionally log
                }
            }
        }

        // 3. CHANNEL – glue so we can yield from multiple worker tasks
        var channel = Channel.CreateUnbounded<ModelFileInfo>(
            new UnboundedChannelOptions { SingleWriter = false, SingleReader = true });

        // Reader side – enumerate until producer and workers are done
        await foreach (var item in channel.Reader.ReadAllAsync(cancel))
            yield return item;

        await Task.WhenAll(producer);   // propagate exceptions
        await Task.WhenAll(workers);    // ensure workers done
    }

    // ----------------------------------------------------------------  HELPERS

    private static ModelFileInfo CreateInfo(string path)
    {
        var fi = new FileInfo(path);

        // Compute hashes
        var sha   = HashUtility.ComputeSha256(path);
        var blake = HashUtility.ComputeBlake3(path);

        return new ModelFileInfo(
            FullPath:      fi.FullName,
            SizeBytes:     fi.Length,
            LastWriteUtc:  fi.LastWriteTimeUtc,
            Sha256:        sha,
            Blake3:        blake);
    }
}
