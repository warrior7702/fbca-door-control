using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models;

/// <summary>
/// Immutable audit log of every door unlock/lock action.
/// Provides complete traceability and debugging history.
/// </summary>
public class ScheduleActionLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int ActionID { get; set; }

    /// <summary>
    /// Which schedule triggered this action (nullable for manual actions)
    /// </summary>
    [ForeignKey(nameof(UnlockSchedule))]
    public int? ScheduleID { get; set; }

    /// <summary>
    /// Which door was affected
    /// </summary>
    [Required]
    [ForeignKey(nameof(Door))]
    public int DoorID { get; set; }

    /// <summary>
    /// Action type: UNLOCK or LOCK
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string ActionType { get; set; } = string.Empty;

    /// <summary>
    /// When the action was executed (UTC)
    /// </summary>
    [Required]
    public DateTime ActionTime { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Did the action succeed?
    /// </summary>
    [Required]
    public bool Success { get; set; }

    /// <summary>
    /// Error message if action failed
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// What triggered this action: Schedule, Manual, System
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string TriggeredBy { get; set; } = string.Empty;

    /// <summary>
    /// HTTP status code from MonitorCast Quick Controls API
    /// </summary>
    public int? VIAResponseCode { get; set; }

    /// <summary>
    /// Full response body from MonitorCast (for debugging)
    /// </summary>
    public string? VIAResponseBody { get; set; }

    // Navigation properties
    public UnlockSchedule? UnlockSchedule { get; set; }
    public Door Door { get; set; } = null!;
}
