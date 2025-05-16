// ============================================================================
// FILE:     /src/ModelsNexus.Core/Providers/Civitai/CivitaiClient.cs
// PROJECT:  ModelsNexus.Core
// SUMMARY:  Thin wrapper over Civitai REST API v1. Requires PAT supplied in
//           SettingsDialog; the PAT is passed as 'Authorization: Bearer ...'.
// ============================================================================

using System.Net.Http.Json;
using ModelsNexus.Core.Settings;

namespace ModelsNexus.Core.Providers.Civitai;

public sealed class CivitaiClient
{
    private readonly HttpClient    _http;
    private readonly ISettingsService _settings;

    public CivitaiClient(HttpClient http, ISettingsService settings)
    {
        _http     = http;
        _settings = settings;
        _http.BaseAddress = new Uri("https://civitai.com/api/");
    }

    /// <summary>Lookup by SHA-256. Returns <c>null</c> if not found.</summary>
    public async Task<ModelMetadata?> TryGetByHashAsync(string sha256, CancellationToken ct = default)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, $"v1/model-versions/by-hash/{sha256}");
        var pat = _settings.CivitaiPat;
        if (!string.IsNullOrWhiteSpace(pat))
            req.Headers.Authorization = new("Bearer", pat);

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound) return null;

        resp.EnsureSuccessStatusCode();

        var model = await resp.Content.ReadFromJsonAsync<CivitaiModelVersion>(cancellationToken: ct);
        if (model is null) return null;

        return new ModelMetadata(
            DisplayName : model.Model.Name,
            Author      : model.Model.Creator?.Username,
            TriggerWords: string.Join(", ", model.TriggerWords ?? []),
            UsageTips   : model.TrainingDetails,
            SourceUrl   : $"https://civitai.com/models/{model.ModelId}",
            BaseModelId : BaseModelMapper.Map(model.BaseModel),
            ModelTypeId : ModelTypeMapper.Map(model.ModelType),
            ImageUrls   : model.Images.Select(i => i.Url).ToList(),
            Sha256      : sha256);
    }

    #region ░░ DTOs ░░─────────────────────────────────────────────────────────
    private sealed record CivitaiModelVersion(
        int                Id,
        int                ModelId,
        string             BaseModel,
        string             ModelType,
        string?            TrainingDetails,
        IReadOnlyList<string>? TriggerWords,
        IReadOnlyList<CivitaiImage> Images,
        CivitaiModelShort  Model);

    private sealed record CivitaiImage(string Url);
    private sealed record CivitaiModelShort(string Name, CivitaiUser? Creator);
    private sealed record CivitaiUser(string Username);
    #endregion
}