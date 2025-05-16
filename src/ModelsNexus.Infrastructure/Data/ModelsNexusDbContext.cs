// ============================================================================
// FILE:     /src/ModelsNexus.Infrastructure/Data/ModelsNexusDbContext.cs
// PROJECT:  ModelsNexus.Infrastructure
// AUTHOR:   Models Nexus (MIT Licence)
// SUMMARY:  Entity Framework Core DbContext for persisting model metadata.
//           Uses SQLite single-file DB located in %LOCALAPPDATA%\ModelsNexus.
// ============================================================================

using Microsoft.EntityFrameworkCore;
using ModelsNexus.Infrastructure.Entities;

namespace ModelsNexus.Infrastructure.Data;

/// <summary>
/// Primary EF Core context. Configure with
/// <code>
///     services.AddDbContext<ModelsNexusDbContext>(opts =>
///         opts.UseSqlite($"Data Source={dbPath};"));
/// </code>
/// in your DI container (AppHost).
/// </summary>
public sealed class ModelsNexusDbContext : DbContext
{
    public DbSet<ModelEntity>      Models      => Set<ModelEntity>();
    public DbSet<BaseModelEntity>  BaseModels  => Set<BaseModelEntity>();
    public DbSet<ModelTypeEntity>  ModelTypes  => Set<ModelTypeEntity>();
    public DbSet<ImageEntity>      Images      => Set<ImageEntity>();

    public ModelsNexusDbContext(DbContextOptions<ModelsNexusDbContext> options)
        : base(options) { }

    protected override void OnModelCreating(ModelBuilder b)
    {
        // ---- ModelEntity ----------------------------------------------------
        b.Entity<ModelEntity>(e =>
        {
            e.HasKey(m => m.Id);
            e.HasIndex(m => m.Sha256).IsUnique();
            e.HasOne(m => m.BaseModel)
             .WithMany(bm => bm.Models)
             .HasForeignKey(m => m.BaseModelId);
            e.HasOne(m => m.ModelType)
             .WithMany(mt => mt.Models)
             .HasForeignKey(m => m.ModelTypeId);
        });

        // ---- Seed: Base models ---------------------------------------------
        var baseSeed = new[]
        {
            new BaseModelEntity { Id = 1, Name = "SD 1.x"          },
            new BaseModelEntity { Id = 2, Name = "SD XL"           },
            new BaseModelEntity { Id = 3, Name = "SD3"             },
            new BaseModelEntity { Id = 4, Name = "Pony"            },
            new BaseModelEntity { Id = 5, Name = "FLUX"            },
            new BaseModelEntity { Id = 6, Name = "SDXL Lightning"  },
            new BaseModelEntity { Id = 7, Name = "Hunyuan Video"   },
            new BaseModelEntity { Id = 8, Name = "Illustrious"     },
            new BaseModelEntity { Id = 9, Name = "HiDream"         }
        };
        b.Entity<BaseModelEntity>().HasData(baseSeed);

        // ---- Seed: Model types / tabs --------------------------------------
        var typeSeed = new[]
        {
            new ModelTypeEntity { Id = 1, Name = "Models"     },
            new ModelTypeEntity { Id = 2, Name = "LoRAs"      },
            new ModelTypeEntity { Id = 3, Name = "ControlNet" },
            new ModelTypeEntity { Id = 4, Name = "Upscaler"   },
            new ModelTypeEntity { Id = 5, Name = "Motion"     },
            new ModelTypeEntity { Id = 6, Name = "VAE"        },
            new ModelTypeEntity { Id = 7, Name = "Workflows"  }
        };
        b.Entity<ModelTypeEntity>().HasData(typeSeed);
    }
}
