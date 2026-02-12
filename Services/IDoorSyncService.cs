using FBCADoorControl.Models;

namespace FBCADoorControl.Services;

/// <summary>
/// Service for synchronizing door data from VIA database to our database.
/// </summary>
public interface IDoorSyncService
{
    /// <summary>
    /// Sync all doors from VIA database to our Doors table.
    /// </summary>
    /// <returns>Result with statistics about the sync operation</returns>
    Task<DoorSyncResult> SyncDoorsAsync();

    /// <summary>
    /// Get list of doors from VIA database.
    /// </summary>
    /// <returns>List of doors from VIA HW_Devices table</returns>
    Task<List<Door>> GetDoorsFromVIAAsync();
}

/// <summary>
/// Result of a door sync operation.
/// </summary>
public class DoorSyncResult
{
    public int DoorsAdded { get; set; }
    public int DoorsUpdated { get; set; }
    public int DoorsDeactivated { get; set; }
    public DateTime SyncTime { get; set; } = DateTime.UtcNow;
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}
