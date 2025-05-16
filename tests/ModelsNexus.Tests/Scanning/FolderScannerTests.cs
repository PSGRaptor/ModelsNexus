// ============================================================================
// FILE:     /tests/ModelsNexus.Tests/Scanning/FolderScannerTests.cs
// PROJECT:  ModelsNexus.Tests
// AUTHOR:   Models Nexus (MIT Licence)
// SUMMARY:  Verifies FolderScanner can locate files and compute correct hashes.
//           Uses a temporary test directory populated at runtime.
// ============================================================================

using System.Text;
using FluentAssertions;
using ModelsNexus.Core.Hashing;
using ModelsNexus.Core.Scanning;

namespace ModelsNexus.Tests.Scanning;

public class FolderScannerTests
{
    [Fact]
    public async Task Scanner_finds_file_and_hashes_match()
    {
        // Arrange – create a temp folder with one fake model file
        using var tmp = new TempFolder();
        var filePath  = Path.Combine(tmp.Path, "test_model.safetensors");
        await File.WriteAllTextAsync(filePath, "HELLO MODELS NEXUS");

        var expectedSha   = HashUtility.ComputeSha256(filePath);
        var expectedBlake = HashUtility.ComputeBlake3(filePath);

        var sut = new FolderScanner();

        // Act
        var results = await sut.ScanAsync([tmp.Path]).ToListAsync();

        // Assert
        results.Should().ContainSingle();
        var info = results.Single();

        info.FullPath.Should().Be(filePath);
        info.Sha256  .Should().Be(expectedSha);
        info.Blake3  .Should().Be(expectedBlake);
    }

    // ---- helpers -----------------------------------------------------------

    private sealed class TempFolder : IDisposable
    {
        public string Path { get; } = System.IO.Path.Combine(
            System.IO.Path.GetTempPath(), Guid.NewGuid().ToString("N"));

        public TempFolder() => Directory.CreateDirectory(Path);
        public void Dispose()
        {
            try { Directory.Delete(Path, true); }
            catch { /* ignore */ }
        }
    }
}