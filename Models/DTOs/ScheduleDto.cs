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
    public bool IsRecurring { get; set; }
    public string EventType { get; set; } = "Special";
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
}

public class ScheduleListResponse
{
    public List<ScheduleDto> Schedules { get; set; } = new();
    public int Total { get; set; }
}

public class CreateScheduleRequest
{
    public int? DoorId { get; set; }
    public string? DoorName { get; set; }  // Alternative to DoorId (partial match supported)
    public string? ScheduleName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? RecurrencePattern { get; set; }
    public DateTime? RecurrenceEndDate { get; set; }
    public string? Source { get; set; }
    public int? Priority { get; set; }  // Optional priority (default: 5)
    public string? EventType { get; set; }  // Optional: Special/Weekly (default: Special)
    public string? Notes { get; set; }  // Optional notes
}

public class ScheduleCreateResponse
{
    public int ScheduleID { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class BatchScheduleDoorRequest
{
    public int DoorId { get; set; }
    public DateTime? CustomStartTime { get; set; }
    public DateTime? CustomEndTime { get; set; }
}

public class CreateBatchScheduleRequest
{
    public string EventName { get; set; } = string.Empty;
    public DateTime DefaultStartTime { get; set; }
    public DateTime DefaultEndTime { get; set; }
    public List<BatchScheduleDoorRequest> Doors { get; set; } = new();
    public string? RecurrencePattern { get; set; }
    public DateTime? RecurrenceEndDate { get; set; }
    public string? Source { get; set; }
}

public class BatchScheduleCreateResponse
{
    public string Message { get; set; } = string.Empty;
    public List<int> ScheduleIds { get; set; } = new();
    public int SuccessCount { get; set; }
    public int ErrorCount { get; set; }
    public List<string>? Errors { get; set; }
}

/// <summary>
/// DTO for a currently active schedule (door is unlocked)
/// </summary>
public class ActiveScheduleDto
{
    public int ScheduleID { get; set; }
    public int DoorID { get; set; }
    public string DoorName { get; set; } = string.Empty;
    public string? ScheduleName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int MinutesRemaining { get; set; }
}

/// <summary>
/// Response for active schedules endpoint
/// </summary>
public class ActiveSchedulesResponse
{
    public DateTime Timestamp { get; set; }
    public int UnlockedDoorCount { get; set; }
    public List<int> UnlockedDoorIds { get; set; } = new();
    public List<ActiveScheduleDto> Schedules { get; set; } = new();
}

/// <summary>
/// DTO for an upcoming schedule (next event for a door)
/// </summary>
public class UpcomingScheduleDto
{
    public int ScheduleID { get; set; }
    public int DoorID { get; set; }
    public string DoorName { get; set; } = string.Empty;
    public string? ScheduleName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int MinutesUntil { get; set; }
}

/// <summary>
/// Response for upcoming schedules endpoint
/// </summary>
public class UpcomingSchedulesResponse
{
    public DateTime Timestamp { get; set; }
    public List<UpcomingScheduleDto> Schedules { get; set; } = new();
}
