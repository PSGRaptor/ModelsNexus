// ============================================================================
// FILE:     /src/ModelsNexus.Core/Providers/HuggingFace/HuggingFaceClient.cs
// PROJECT:  ModelsNexus.Core
// SUMMARY:  Minimal call to HuggingFace Hub's 'model_info' endpoint; only the
//           SHA-256 lookup is supported (via search API + filtering).
// ============================================================================

using System.Net.Http.Json;
using ModelsNexus.Core.Settings;

namespace ModelsNexus.Core.Providers.HuggingFace;

public sealed class HuggingFaceClient
{
    private readonly HttpClient        _http;
    private readonly ISettingsService  _settings;

    public HuggingFaceClient(HttpClient http, ISettingsService settings)
    {
        _http     = http;
        _settings = settings;
        _http.BaseAddress = new Uri("https://huggingface.co/");
    }

    public async Task<ModelMetadata?> TryGetByHashAsync(string sha256, CancellationToken ct = default)
    {
        var pat = _settings.HuggingFacePat;
        if (!string.IsNullOrWhiteSpace(pat))
            _http.DefaultRequestHeaders.Authorization = new("Bearer", pat);

        // Search by hash → returns array of matches
        using var resp = await _http.GetAsync($"api/models?sha={sha256}", ct);
        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
        resp.EnsureSuccessStatusCode();

        var models = await resp.Content.ReadFromJsonAsync<HfSearchResult[]>(cancellationToken: ct);
        var first  = models?.FirstOrDefault();
        if (first is null) return null;

        return new ModelMetadata(
            DisplayName : first.Id,
            Author      : first.Author,
            TriggerWords: null,
            UsageTips   : first.CardData?.GetValueOrDefault("usage")?.ToString(),
            SourceUrl   : $"https://huggingface.co/{first.Id}",
            BaseModelId : BaseModelMapper.Map(first.CardData?.GetValueOrDefault("base_model")?.ToString()),
            ModelTypeId : ModelTypeMapper.Map(first.LibraryName),
            ImageUrls   : (first.Siblings ?? []).Where(s => s.Rfilename.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
                                                .Select(s => $"https://huggingface.co/{first.Id}/resolve/main/{s.Rfilename}")
                                                .ToList(),
            Sha256      : sha256);
    }

    private sealed record HfSearchResult(
        string Id,
        string? Author,
        string LibraryName,
        Dictionary<string, object>? CardData,
        HfSibling[]? Siblings);

    private sealed record HfSibling(string Rfilename);
}