using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models;

/// <summary>
/// Represents a physical door synced from the VIA Access Control system.
/// This is a READ-ONLY mirror of the VIA HW_Devices table.
/// </summary>
public class Door
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int DoorID { get; set; }

    /// <summary>
    /// Links to VIA HW_Devices.DeviceID (unique foreign key)
    /// </summary>
    [Required]
    public int VIADeviceID { get; set; }

    /// <summary>
    /// Human-readable door name (e.g., "Wade Building - Main Entrance")
    /// </summary>
    [Required]
    [MaxLength(255)]
    public string DoorName { get; set; } = string.Empty;

    /// <summary>
    /// VIA controller ID (1-6)
    /// </summary>
    public int? ControllerID { get; set; }

    /// <summary>
    /// VIA controller name (e.g., "Controller 2: Wade Building")
    /// </summary>
    [MaxLength(255)]
    public string? ControllerName { get; set; }

    /// <summary>
    /// VIA controller group ID
    /// WARNING: Never set this to NULL when writing to VIA database (crashes MonitorCast)
    /// </summary>
    public int? ControllerGroupID { get; set; }

    /// <summary>
    /// Can this door be scheduled? (false = deactivated)
    /// </summary>
    [Required]
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Last time door data was synced from VIA database
    /// </summary>
    public DateTime? LastSyncTime { get; set; }

    // Navigation property
    public ICollection<UnlockSchedule> UnlockSchedules { get; set; } = new List<UnlockSchedule>();
    public ICollection<ScheduleActionLog> ActionLogs { get; set; } = new List<ScheduleActionLog>();
}
