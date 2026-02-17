using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FBCADoorControl.Models
{
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
        public string RecurrenceType { get; set; } = "Weekly"; // Weekly, BiWeekly, Monthly

        // For Weekly/BiWeekly: 0=Sunday, 1=Monday, ..., 6=Saturday
        public int? DayOfWeek { get; set; }

        // For Monthly: 1-31
        public int? DayOfMonth { get; set; }

        // For BiWeekly: 2, else 1
        public int? WeekInterval { get; set; } = 1;

        [Required]
        public DateTime StartDate { get; set; }

        public DateTime? EndDate { get; set; } // NULL = indefinite

        public int GenerateWeeksAhead { get; set; } = 4;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [MaxLength(100)]
        public string? CreatedBy { get; set; }

        public DateTime? ModifiedAt { get; set; }

        [MaxLength(100)]
        public string? ModifiedBy { get; set; }

        // Navigation properties
        public virtual ICollection<RecurrencePatternDoor> Doors { get; set; } = new List<RecurrencePatternDoor>();
        public virtual ICollection<RecurrenceInstance> Instances { get; set; } = new List<RecurrenceInstance>();

        // Helper method to get next occurrence date
        public DateTime? GetNextOccurrence(DateTime fromDate)
        {
            if (!IsActive || (EndDate.HasValue && fromDate > EndDate.Value))
                return null;

            if (fromDate < StartDate)
                fromDate = StartDate;

            switch (RecurrenceType)
            {
                case "Weekly":
                    return GetNextWeeklyOccurrence(fromDate, 1);
                
                case "BiWeekly":
                    return GetNextWeeklyOccurrence(fromDate, WeekInterval ?? 2);
                
                case "Monthly":
                    return GetNextMonthlyOccurrence(fromDate);
                
                default:
                    return null;
            }
        }

        private DateTime? GetNextWeeklyOccurrence(DateTime fromDate, int weekInterval)
        {
            if (!DayOfWeek.HasValue) return null;

            var targetDayOfWeek = (DayOfWeek)DayOfWeek.Value;
            var daysUntilTarget = ((int)targetDayOfWeek - (int)fromDate.DayOfWeek + 7) % 7;
            
            if (daysUntilTarget == 0 && fromDate.Date > StartDate.Date)
            {
                // If same day but past start, go to next week
                daysUntilTarget = 7 * weekInterval;
            }

            var nextDate = fromDate.Date.AddDays(daysUntilTarget);

            // For BiWeekly, ensure we're on the correct week cycle
            if (weekInterval > 1)
            {
                var weeksSinceStart = (nextDate - StartDate.Date).Days / 7;
                if (weeksSinceStart % weekInterval != 0)
                {
                    nextDate = nextDate.AddDays(7 * (weekInterval - (weeksSinceStart % weekInterval)));
                }
            }

            return (EndDate.HasValue && nextDate > EndDate.Value) ? null : nextDate;
        }

        private DateTime? GetNextMonthlyOccurrence(DateTime fromDate)
        {
            if (!DayOfMonth.HasValue) return null;

            var nextDate = new DateTime(fromDate.Year, fromDate.Month, Math.Min(DayOfMonth.Value, DateTime.DaysInMonth(fromDate.Year, fromDate.Month)));
            
            if (nextDate <= fromDate.Date)
            {
                // Move to next month
                var nextMonth = fromDate.AddMonths(1);
                nextDate = new DateTime(nextMonth.Year, nextMonth.Month, Math.Min(DayOfMonth.Value, DateTime.DaysInMonth(nextMonth.Year, nextMonth.Month)));
            }

            return (EndDate.HasValue && nextDate > EndDate.Value) ? null : nextDate;
        }
    }

    public class RecurrencePatternDoor
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RecurrencePatternId { get; set; }

        [Required]
        [Column("DoorID")]  // Match existing Doors table column name
        public int DoorID { get; set; }

        public TimeSpan? CustomUnlockTime { get; set; }
        public TimeSpan? CustomLockTime { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Navigation properties
        [ForeignKey("RecurrencePatternId")]
        public virtual RecurrencePattern? RecurrencePattern { get; set; }

        [ForeignKey("DoorID")]
        public virtual Door? Door { get; set; }
    }

    public class RecurrenceInstance
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RecurrencePatternId { get; set; }

        [Required]
        [Column("ScheduleID")]  // Match existing UnlockSchedules table column name
        public int ScheduleID { get; set; }

        [Required]
        public DateTime ScheduledDate { get; set; }

        public DateTime GeneratedAt { get; set; } = DateTime.Now;

        // Navigation properties
        [ForeignKey("RecurrencePatternId")]
        public virtual RecurrencePattern? RecurrencePattern { get; set; }

        [ForeignKey("ScheduleID")]
        public virtual UnlockSchedule? Schedule { get; set; }
    }
}
