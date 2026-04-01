using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models;

public class RecurrencePattern
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string EventName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Required]
    public TimeSpan UnlockTime { get; set; }

    [Required]
    public TimeSpan LockTime { get; set; }

    [Required]
    [MaxLength(20)]
    public string RecurrenceType { get; set; } = string.Empty;

    public int? DayOfWeek { get; set; }
    public int? DayOfMonth { get; set; }
    public int? WeekInterval { get; set; } = 1;

    [Required]
    public DateTime StartDate { get; set; }
    
    public DateTime? EndDate { get; set; }

    [Required]
    public int GenerateWeeksAhead { get; set; } = 4;

    [Required]
    public bool IsActive { get; set; } = true;

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(100)]
    public string? CreatedBy { get; set; }

    public DateTime? ModifiedAt { get; set; }

    [MaxLength(100)]
    public string? ModifiedBy { get; set; }

    // Navigation properties
    public ICollection<RecurrencePatternDoor> Doors { get; set; } = new List<RecurrencePatternDoor>();
    public ICollection<RecurrenceInstance> Instances { get; set; } = new List<RecurrenceInstance>();

    public DateTime? GetNextOccurrence(DateTime fromDate)
    {
        if (EndDate.HasValue && fromDate > EndDate.Value)
            return null;

        switch (RecurrenceType.ToLower())
        {
            case "daily":
                var nextDaily = fromDate.Date >= StartDate.Date ? fromDate.Date : StartDate.Date;
                return EndDate.HasValue && nextDaily > EndDate.Value ? null : nextDaily;

            case "weekly":
            case "biweekly":
                if (!DayOfWeek.HasValue) return null;
                
                var daysUntilNext = ((int)DayOfWeek.Value - (int)fromDate.DayOfWeek + 7) % 7;
                if (daysUntilNext == 0 && fromDate.Date < StartDate.Date)
                    daysUntilNext = 7;
                
                var nextWeekly = fromDate.AddDays(daysUntilNext == 0 ? 7 : daysUntilNext);
                if (nextWeekly < StartDate.Date) nextWeekly = StartDate.Date;
                
                return EndDate.HasValue && nextWeekly > EndDate.Value ? null : nextWeekly;

            case "monthly":
                if (!DayOfMonth.HasValue) return null;
                
                var nextMonth = fromDate.Day >= DayOfMonth.Value ? fromDate.AddMonths(1) : fromDate;
                try
                {
                    var nextMonthly = new DateTime(nextMonth.Year, nextMonth.Month, DayOfMonth.Value);
                    if (nextMonthly < StartDate.Date) nextMonthly = StartDate.Date;
                    return EndDate.HasValue && nextMonthly > EndDate.Value ? null : nextMonthly;
                }
                catch
                {
                    return null;
                }

            default:
                return null;
        }
    }
}
