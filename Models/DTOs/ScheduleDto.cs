namespace FBCADoorControl.Models.DTOs;

public class ScheduleDto
{
    public int ScheduleID { get; set; }
    public int DoorID { get; set; }
    public string DoorName { get; set; } = string.Empty;
    public string? ScheduleName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? RecurrencePattern { get; set; }
    public DateTime? RecurrenceEndDate { get; set; }
    public string Source { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ScheduleListResponse
{
    public List<ScheduleDto> Schedules { get; set; } = new();
    public int Total { get; set; }
}

public class CreateScheduleRequest
{
    public int DoorId { get; set; }
    public string? ScheduleName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? RecurrencePattern { get; set; }
    public DateTime? RecurrenceEndDate { get; set; }
    public string? Source { get; set; }
}

public class ScheduleCreateResponse
{
    public int ScheduleID { get; set; }
    public string Message { get; set; } = string.Empty;
}
