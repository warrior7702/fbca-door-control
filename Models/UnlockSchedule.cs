using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models;

/// <summary>
/// Represents a door unlock/lock schedule.
/// Doors unlock at StartTime and lock at EndTime.
/// </summary>
public class UnlockSchedule
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int ScheduleID { get; set; }

    /// <summary>
    /// Which door this schedule applies to
    /// </summary>
    [Required]
    [ForeignKey(nameof(Door))]
    public int DoorID { get; set; }

    /// <summary>
    /// Optional user-friendly name for the schedule
    /// </summary>
    [MaxLength(255)]
    public string? ScheduleName { get; set; }

    /// <summary>
    /// When to unlock the door (UTC)
    /// </summary>
    [Required]
    public DateTime StartTime { get; set; }

    /// <summary>
    /// When to lock the door back (UTC)
    /// </summary>
    [Required]
    public DateTime EndTime { get; set; }

    /// <summary>
    /// Recurrence pattern: NONE, DAILY, WEEKLY, MONTHLY
    /// Phase 2 feature - for now, only NONE supported
    /// </summary>
    [MaxLength(50)]
    public string? RecurrencePattern { get; set; } = "NONE";

    /// <summary>
    /// When recurrence stops (if recurring)
    /// Phase 2 feature
    /// </summary>
    public DateTime? RecurrenceEndDate { get; set; }

    /// <summary>
    /// Source of the schedule: Manual, PCO (Planning Center Online), System
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Source { get; set; } = "Manual";

    /// <summary>
    /// Is this schedule active? (false = disabled but not deleted)
    /// </summary>
    [Required]
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Who created this schedule (Phase 3 - authentication)
    /// </summary>
    [MaxLength(255)]
    public string? CreatedBy { get; set; }

    /// <summary>
    /// When schedule was created
    /// </summary>
    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Last update timestamp
    /// </summary>
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public Door Door { get; set; } = null!;
    public ICollection<ScheduleActionLog> ActionLogs { get; set; } = new List<ScheduleActionLog>();
}
