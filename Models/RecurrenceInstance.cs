using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models;

public class RecurrenceInstance
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int RecurrencePatternId { get; set; }

    [Required]
    public int ScheduleID { get; set; }

    [Required]
    public DateTime ScheduledDate { get; set; }

    [Required]
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(RecurrencePatternId))]
    public RecurrencePattern Pattern { get; set; } = null!;

    [ForeignKey(nameof(ScheduleID))]
    public UnlockSchedule Schedule { get; set; } = null!;
}
