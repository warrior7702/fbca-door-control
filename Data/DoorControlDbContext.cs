using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Models;

namespace FBCADoorControl.Data;

/// <summary>
/// Database context for FBCADoorControl database (our data).
/// Manages Doors, UnlockSchedules, and ScheduleActionLog tables.
/// </summary>
public class DoorControlDbContext : DbContext
{
    public DoorControlDbContext(DbContextOptions<DoorControlDbContext> options)
        : base(options)
    {
    }

    public DbSet<Door> Doors { get; set; } = null!;
    public DbSet<UnlockSchedule> UnlockSchedules { get; set; } = null!;
    public DbSet<ScheduleActionLog> ScheduleActionLogs { get; set; } = null!;
    public DbSet<RecurrencePattern> RecurrencePatterns { get; set; } = null!;
    public DbSet<RecurrencePatternDoor> RecurrencePatternDoors { get; set; } = null!;
    public DbSet<RecurrenceInstance> RecurrenceInstances { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Door configuration
        modelBuilder.Entity<Door>(entity =>
        {
            entity.HasKey(e => e.DoorID);
            entity.HasIndex(e => e.VIADeviceID).IsUnique();
            entity.HasIndex(e => e.IsActive);
            
            entity.Property(e => e.DoorName).IsRequired().HasMaxLength(255);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
        });

        // UnlockSchedule configuration
        modelBuilder.Entity<UnlockSchedule>(entity =>
        {
            entity.HasKey(e => e.ScheduleID);
            entity.HasIndex(e => e.StartTime);
            entity.HasIndex(e => e.IsActive);
            
            entity.Property(e => e.Source).IsRequired().HasMaxLength(50).HasDefaultValue("Manual");
            entity.Property(e => e.RecurrencePattern).HasMaxLength(50).HasDefaultValue("NONE");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            
            // Relationship: UnlockSchedule -> Door
            entity.HasOne(e => e.Door)
                  .WithMany(d => d.UnlockSchedules)
                  .HasForeignKey(e => e.DoorID)
                  .OnDelete(DeleteBehavior.Cascade);
            
            // Validation: EndTime must be after StartTime
            entity.ToTable(t => t.HasCheckConstraint("CHK_EndTime", "[EndTime] > [StartTime]"));
        });

        // ScheduleActionLog configuration
        modelBuilder.Entity<ScheduleActionLog>(entity =>
        {
            entity.HasKey(e => e.ActionID);
            entity.HasIndex(e => e.ActionTime).IsDescending();
            entity.HasIndex(e => e.DoorID);
            
            entity.Property(e => e.ActionType).IsRequired().HasMaxLength(20);
            entity.Property(e => e.TriggeredBy).IsRequired().HasMaxLength(50);
            entity.Property(e => e.ActionTime).HasDefaultValueSql("GETUTCDATE()");
            
            // Relationship: ActionLog -> UnlockSchedule (nullable)
            entity.HasOne(e => e.UnlockSchedule)
                  .WithMany(s => s.ActionLogs)
                  .HasForeignKey(e => e.ScheduleID)
                  .OnDelete(DeleteBehavior.SetNull);
            
            // Relationship: ActionLog -> Door
            entity.HasOne(e => e.Door)
                  .WithMany(d => d.ActionLogs)
                  .HasForeignKey(e => e.DoorID)
                  .OnDelete(DeleteBehavior.Restrict); // Don't delete logs when door deleted
        });
    }
}
