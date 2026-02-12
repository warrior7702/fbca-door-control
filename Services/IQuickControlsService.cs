namespace FBCADoorControl.Services;

/// <summary>
/// Service for interacting with MonitorCast Quick Controls API.
/// Handles authentication, session management, and door unlock/lock commands.
/// </summary>
public interface IQuickControlsService
{
    /// <summary>
    /// Unlock a door via MonitorCast Quick Controls API.
    /// </summary>
    /// <param name="viaDeviceId">VIA device ID from HW_Devices table</param>
    /// <returns>True if successful, false otherwise</returns>
    Task<bool> UnlockDoorAsync(int viaDeviceId);

    /// <summary>
    /// Lock a door via MonitorCast Quick Controls API.
    /// </summary>
    /// <param name="viaDeviceId">VIA device ID from HW_Devices table</param>
    /// <returns>True if successful, false otherwise</returns>
    Task<bool> LockDoorAsync(int viaDeviceId);

    /// <summary>
    /// Authenticate to MonitorCast and obtain session cookies.
    /// </summary>
    /// <returns>True if authentication succeeded</returns>
    Task<bool> AuthenticateAsync();

    /// <summary>
    /// Check if current session is still valid.
    /// </summary>
    /// <returns>True if authenticated and session active</returns>
    Task<bool> IsAuthenticatedAsync();

    /// <summary>
    /// Execute a Quick Controls action (unlock or lock).
    /// </summary>
    /// <param name="viaDeviceId">VIA device ID</param>
    /// <param name="action">Action: "unlock" or "lock"</param>
    /// <returns>Response with success status and details</returns>
    Task<QuickControlsResponse> ExecuteActionAsync(int viaDeviceId, string action);
}

/// <summary>
/// Response from MonitorCast Quick Controls API.
/// </summary>
public class QuickControlsResponse
{
    public bool Success { get; set; }
    public int StatusCode { get; set; }
    public string? ResponseBody { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
