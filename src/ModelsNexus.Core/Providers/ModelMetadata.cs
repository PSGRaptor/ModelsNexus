// ============================================================================
// FILE:     /src/ModelsNexus.Core/Providers/ModelMetadata.cs
// PROJECT:  ModelsNexus.Core
// SUMMARY:  Canonical DTO used by *all* provider clients to return metadata.
// ============================================================================

namespace ModelsNexus.Core.Providers;

public sealed record ModelMetadata(
    string?  DisplayName,
    string?  Author,
    string?  TriggerWords,
    string?  UsageTips,
    string?  SourceUrl,
    int      BaseModelId,
    int      ModelTypeId,
    IReadOnlyList<string> ImageUrls,
    string   Sha256);
