namespace FBCADoorControl.Models.DTOs;

public class DoorDto
{
    public int DoorID { get; set; }
    public int VIADeviceID { get; set; }
    public string DoorName { get; set; } = string.Empty;
    public int? ControllerID { get; set; }
    public string? ControllerName { get; set; }
    public bool IsActive { get; set; }
    public DateTime? LastSyncTime { get; set; }
}

public class DoorListResponse
{
    public List<DoorDto> Doors { get; set; } = new();
    public int Total { get; set; }
}

public class DoorSyncResultDto
{
    public string Message { get; set; } = string.Empty;
    public int DoorsAdded { get; set; }
    public int DoorsUpdated { get; set; }
    public int DoorsDeactivated { get; set; }
    public DateTime SyncTime { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}

public class QuickControlsTestRequest
{
    public string Action { get; set; } = string.Empty; // "unlock" or "lock"
}

public class QuickControlsTestResult
{
    public bool Success { get; set; }
    public int DoorID { get; set; }
    public string DoorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public int? VIAResponseCode { get; set; }
    public string? ErrorMessage { get; set; }
}
