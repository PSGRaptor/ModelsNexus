namespace ModelsNexus.Infrastructure.Entities;

public sealed class ImageEntity
{
    public int    Id         { get; set; }
    public string Url        { get; set; } = default!;
    public string LocalPath  { get; set; } = default!; // cached thumbnail
    public int    ModelId    { get; set; }
    public ModelEntity Model { get; set; } = default!;
}