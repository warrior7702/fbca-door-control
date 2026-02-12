using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Models;

namespace FBCADoorControl.Services;

/// <summary>
/// Service for synchronizing door data from VIA database (READ-ONLY).
/// Creates a local mirror of VIA doors in our Doors table.
/// </summary>
public class DoorSyncService : IDoorSyncService
{
    private readonly DoorControlDbContext _doorControlDb;
    private readonly VIACDbContext _viacDb;
    private readonly ILogger<DoorSyncService> _logger;

    public DoorSyncService(
        DoorControlDbContext doorControlDb,
        VIACDbContext viacDb,
        ILogger<DoorSyncService> logger)
    {
        _doorControlDb = doorControlDb;
        _viacDb = viacDb;
        _logger = logger;
    }

    public async Task<List<Door>> GetDoorsFromVIAAsync()
    {
        try
        {
            _logger.LogInformation("Reading doors from VIA database...");

            // Query VIA database for all active door devices
            var viaDevices = await _viacDb.HW_Devices
                .Where(d => d.IsActive)
                .ToListAsync();

            // Get controller info for reference
            var controllers = await _viacDb.HW_Controllers
                .ToListAsync();

            var doors = viaDevices.Select(d =>
            {
                var controller = controllers.FirstOrDefault(c => c.ControllerID == d.ControllerID);
                
                return new Door
                {
                    VIADeviceID = d.DeviceID,
                    DoorName = d.DeviceName,
                    ControllerID = d.ControllerID,
                    ControllerName = controller?.ControllerName,
                    ControllerGroupID = controller?.ControllerGroupID,
                    IsActive = d.IsActive,
                    LastSyncTime = DateTime.UtcNow
                };
            }).ToList();

            _logger.LogInformation("Retrieved {Count} doors from VIA database", doors.Count);
            return doors;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading doors from VIA database");
            throw;
        }
    }

    public async Task<DoorSyncResult> SyncDoorsAsync()
    {
        var result = new DoorSyncResult();

        try
        {
            _logger.LogInformation("Starting door sync from VIA database...");

            var viaDevices = await GetDoorsFromVIAAsync();
            var existingDoors = await _doorControlDb.Doors.ToListAsync();

            foreach (var viaDoor in viaDevices)
            {
                var existingDoor = existingDoors.FirstOrDefault(d => d.VIADeviceID == viaDoor.VIADeviceID);

                if (existingDoor == null)
                {
                    // New door - add it
                    _doorControlDb.Doors.Add(viaDoor);
                    result.DoorsAdded++;
                    
                    _logger.LogInformation(
                        "Adding new door: {DoorName} (VIA Device ID: {DeviceId})",
                        viaDoor.DoorName, viaDoor.VIADeviceID);
                }
                else
                {
                    // Existing door - update it
                    existingDoor.DoorName = viaDoor.DoorName;
                    existingDoor.ControllerID = viaDoor.ControllerID;
                    existingDoor.ControllerName = viaDoor.ControllerName;
                    existingDoor.ControllerGroupID = viaDoor.ControllerGroupID;
                    existingDoor.IsActive = viaDoor.IsActive;
                    existingDoor.LastSyncTime = DateTime.UtcNow;
                    
                    result.DoorsUpdated++;
                }
            }

            // Deactivate doors that exist in our DB but not in VIA (removed doors)
            var viaDeviceIds = viaDevices.Select(d => d.VIADeviceID).ToHashSet();
            var doorsToDeactivate = existingDoors
                .Where(d => d.IsActive && !viaDeviceIds.Contains(d.VIADeviceID))
                .ToList();

            foreach (var door in doorsToDeactivate)
            {
                _logger.LogWarning(
                    "Deactivating door no longer in VIA: {DoorName} (VIA Device ID: {DeviceId})",
                    door.DoorName, door.VIADeviceID);
                
                door.IsActive = false;
                door.LastSyncTime = DateTime.UtcNow;
                result.DoorsDeactivated++;
            }

            // Save all changes in a transaction
            await _doorControlDb.SaveChangesAsync();

            result.Success = true;
            result.SyncTime = DateTime.UtcNow;

            _logger.LogInformation(
                "Door sync complete: Added={Added}, Updated={Updated}, Deactivated={Deactivated}",
                result.DoorsAdded, result.DoorsUpdated, result.DoorsDeactivated);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during door sync");
            result.Success = false;
            result.ErrorMessage = ex.Message;
            return result;
        }
    }
}
