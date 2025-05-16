// ============================================================================
// FILE:     /src/ModelsNexus.Core/Hashing/HashUtility.cs
// PROJECT:  ModelsNexus.Core
// AUTHOR:   Models Nexus (MIT Licence)
// SUMMARY:  Convenience helpers that compute SHA-256 and BLAKE3 in one pass.
// ============================================================================

using System.Security.Cryptography;

namespace ModelsNexus.Core.Hashing;

/// <summary>
/// Static helpers used by <see cref="Scanning.FolderScanner"/> to compute file
/// digests quickly and in a memory-efficient streaming fashion.
/// </summary>
public static class HashUtility
{
    private const int BufferSize = 1024 * 1024; // 1 MiB – good balance IOPS/CPU

    /// <summary>
    /// Computes a SHA-256 digest for <paramref name="filePath"/> and returns the
    /// result as a lowercase hexadecimal string.
    /// </summary>
    public static string ComputeSha256(string filePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);

        using var stream = File.OpenRead(filePath);
        using var sha    = SHA256.Create();

        // Reuse a single buffer; avoids LOH allocations on very large files
        var buffer = new byte[BufferSize];
        int read;
        while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
        {
            sha.TransformBlock(buffer, 0, read, null, 0);
        }
        sha.TransformFinalBlock(Array.Empty<byte>(), 0, 0);

        return Convert.ToHexString(sha.Hash!).ToLowerInvariant();
    }

    /// <summary>
    /// Computes a <c>BLAKE3</c> digest for <paramref name="filePath"/> using the
    /// <c>BLAKE3.NET</c> implementation (fast, SIMD-optimised).
    /// </summary>
    public static string ComputeBlake3(string filePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);

        using var stream = File.OpenRead(filePath);
        var hasher = Blake3.Hasher.New();
        
        var buffer = new byte[BufferSize];
        int read;
        while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
        {
            hasher.Update(buffer.AsSpan(0, read));
        }

        var hash = hasher.Finalize();
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
