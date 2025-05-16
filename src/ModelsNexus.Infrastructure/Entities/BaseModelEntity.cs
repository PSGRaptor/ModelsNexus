namespace ModelsNexus.Infrastructure.Entities;

public sealed class BaseModelEntity
{
    public int    Id   { get; set; }
    public string Name { get; set; } = default!;

    public ICollection<ModelEntity> Models { get; set; } = new List<ModelEntity>();
}