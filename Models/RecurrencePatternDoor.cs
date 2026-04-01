using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models;

public class RecurrencePatternDoor
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int RecurrencePatternId { get; set; }

    [Required]
    public int DoorID { get; set; }

    public TimeSpan? CustomUnlockTime { get; set; }
    
    public TimeSpan? CustomLockTime { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey(nameof(RecurrencePatternId))]
    public RecurrencePattern Pattern { get; set; } = null!;

    [ForeignKey(nameof(DoorID))]
    public Door Door { get; set; } = null!;
}
