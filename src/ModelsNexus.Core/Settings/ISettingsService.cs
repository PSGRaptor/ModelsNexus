namespace ModelsNexus.Core.Settings;

public interface ISettingsService
{
    string? CivitaiPat      { get; }
    string? HuggingFacePat  { get; }

    // Called by SettingsDialog
    Task SaveAsync(string? civitaiPat, string? hfPat, IEnumerable<string> folders);
    IReadOnlyList<string> ScanFolders { get; }
}