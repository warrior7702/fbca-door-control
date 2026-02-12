using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Data;

/// <summary>
/// READ-ONLY database context for VIA Access Control database.
/// NEVER write to this database - only read door/controller information.
/// </summary>
public class VIACDbContext : DbContext
{
    public VIACDbContext(DbContextOptions<VIACDbContext> options)
        : base(options)
    {
    }

    public DbSet<VIADevice> HW_Devices { get; set; } = null!;
    public DbSet<VIAController> HW_Controllers { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Map to existing VIA tables (read-only)
        modelBuilder.Entity<VIADevice>(entity =>
        {
            entity.ToTable("HW_Devices");
            entity.HasKey(e => e.DeviceID);
            // Note: HasKey() is sufficient - HasNoKey() removed as it conflicts with HasKey()
        });

        modelBuilder.Entity<VIAController>(entity =>
        {
            entity.ToTable("HW_Controllers");
            entity.HasKey(e => e.ControllerID);
            // Note: HasKey() is sufficient - HasNoKey() removed as it conflicts with HasKey()
        });
    }
}

/// <summary>
/// Represents a VIA door device (HW_Devices table).
/// READ-ONLY - for syncing to our Doors table only.
/// </summary>
public class VIADevice
{
    public int DeviceID { get; set; }
    public string DeviceName { get; set; } = string.Empty;
    public int? ControllerID { get; set; }
    
    [Column("Active")]  // Map to 'Active' column in database (not 'IsActive')
    public bool IsActive { get; set; }
    // Add other fields as needed for syncing
}

/// <summary>
/// Represents a VIA controller (HW_Controllers table).
/// READ-ONLY - for reference information only.
/// </summary>
public class VIAController
{
    public int ControllerID { get; set; }
    public string ControllerName { get; set; } = string.Empty;
    public int? ControllerGroupID { get; set; }
    
    [Column("Active")]  // Map to 'Active' column in database (not 'IsActive')
    public bool IsActive { get; set; }
}
