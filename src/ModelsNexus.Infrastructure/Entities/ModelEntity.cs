// ============================================================================
// FILE:     /src/ModelsNexus.Infrastructure/Entities/ModelEntity.cs
// PROJECT:  ModelsNexus.Infrastructure
// SUMMARY:  Core table that maps one on-disk artefact to online metadata.
// ============================================================================

namespace ModelsNexus.Infrastructure.Entities;

public sealed class ModelEntity
{
    public int      Id            { get; set; }
    public string   FilePath      { get; set; } = default!;
    public long     SizeBytes     { get; set; }
    public DateTime LastWriteUtc  { get; set; }

    public string   Sha256        { get; set; } = default!;
    public string   Blake3        { get; set; } = default!;

    // Online metadata --------------------------------------------------------
    public string?  DisplayName   { get; set; }
    public string?  Author        { get; set; }
    public string?  TriggerWords  { get; set; }
    public string?  UsageTips     { get; set; }
    public string?  SourceUrl     { get; set; }

    // FK → Base model (e.g., SD XL)
    public int BaseModelId        { get; set; }
    public BaseModelEntity BaseModel { get; set; } = default!;

    // FK → Model type / nav tab
    public int ModelTypeId        { get; set; }
    public ModelTypeEntity ModelType { get; set; } = default!;

    public ICollection<ImageEntity> Images { get; set; } = new List<ImageEntity>();
}
