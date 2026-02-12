using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Models;
using FBCADoorControl.Services;
using FBCADoorControl.Models.DTOs;

namespace FBCADoorControl.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DoorsController : ControllerBase
{
    private readonly DoorControlDbContext _dbContext;
    private readonly IDoorSyncService _doorSyncService;
    private readonly IQuickControlsService _quickControls;
    private readonly ILogger<DoorsController> _logger;

    public DoorsController(
        DoorControlDbContext dbContext,
        IDoorSyncService doorSyncService,
        IQuickControlsService quickControls,
        ILogger<DoorsController> logger)
    {
        _dbContext = dbContext;
        _doorSyncService = doorSyncService;
        _quickControls = quickControls;
        _logger = logger;
    }

    /// <summary>
    /// Get list of all doors with optional filtering.
    /// GET /api/doors?isActive=true&controllerId=2
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<DoorListResponse>> GetDoors(
        [FromQuery] bool? isActive = null,
        [FromQuery] int? controllerId = null)
    {
        try
        {
            var query = _dbContext.Doors.AsQueryable();

            if (isActive.HasValue)
            {
                query = query.Where(d => d.IsActive == isActive.Value);
            }

            if (controllerId.HasValue)
            {
                query = query.Where(d => d.ControllerID == controllerId.Value);
            }

            var doors = await query
                .OrderBy(d => d.ControllerID)
                .ThenBy(d => d.DoorName)
                .ToListAsync();

            var doorDtos = doors.Select(d => new DoorDto
            {
                DoorID = d.DoorID,
                VIADeviceID = d.VIADeviceID,
                DoorName = d.DoorName,
                ControllerID = d.ControllerID,
                ControllerName = d.ControllerName,
                IsActive = d.IsActive,
                LastSyncTime = d.LastSyncTime
            }).ToList();

            return Ok(new DoorListResponse
            {
                Doors = doorDtos,
                Total = doorDtos.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving doors");
            return StatusCode(500, new { error = "Failed to retrieve doors", details = ex.Message });
        }
    }

    /// <summary>
    /// Get a specific door by ID.
    /// GET /api/doors/5
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<DoorDto>> GetDoor(int id)
    {
        try
        {
            var door = await _dbContext.Doors.FindAsync(id);

            if (door == null)
            {
                return NotFound(new { error = "Door not found", doorId = id });
            }

            return Ok(new DoorDto
            {
                DoorID = door.DoorID,
                VIADeviceID = door.VIADeviceID,
                DoorName = door.DoorName,
                ControllerID = door.ControllerID,
                ControllerName = door.ControllerName,
                IsActive = door.IsActive,
                LastSyncTime = door.LastSyncTime
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving door {DoorId}", id);
            return StatusCode(500, new { error = "Failed to retrieve door", details = ex.Message });
        }
    }

    /// <summary>
    /// Sync doors from VIA database.
    /// POST /api/doors/sync
    /// </summary>
    [HttpPost("sync")]
    public async Task<ActionResult<DoorSyncResultDto>> SyncDoors()
    {
        try
        {
            _logger.LogInformation("Manual door sync requested");

            var result = await _doorSyncService.SyncDoorsAsync();

            return Ok(new DoorSyncResultDto
            {
                Message = "Door sync completed",
                DoorsAdded = result.DoorsAdded,
                DoorsUpdated = result.DoorsUpdated,
                DoorsDeactivated = result.DoorsDeactivated,
                SyncTime = result.SyncTime,
                Success = result.Success,
                ErrorMessage = result.ErrorMessage
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during manual door sync");
            return StatusCode(500, new
            {
                error = "Door sync failed",
                details = ex.Message
            });
        }
    }

    /// <summary>
    /// Test immediate unlock/lock of a door.
    /// POST /api/doors/5/test-quick-controls
    /// Body: { "action": "unlock" }
    /// </summary>
    [HttpPost("{id}/test-quick-controls")]
    public async Task<ActionResult<QuickControlsTestResult>> TestQuickControls(
        int id,
        [FromBody] QuickControlsTestRequest request)
    {
        try
        {
            var door = await _dbContext.Doors.FindAsync(id);

            if (door == null)
            {
                return NotFound(new { error = "Door not found", doorId = id });
            }

            if (!door.IsActive)
            {
                return BadRequest(new { error = "Door is not active", doorId = id });
            }

            var action = request.Action?.ToLower();
            if (action != "unlock" && action != "lock")
            {
                return BadRequest(new { error = "Action must be 'unlock' or 'lock'", action = request.Action });
            }

            _logger.LogInformation(
                "Testing Quick Controls: {Action} door {DoorName} (VIA Device {DeviceId})",
                action, door.DoorName, door.VIADeviceID);

            var response = await _quickControls.ExecuteActionAsync(door.VIADeviceID, action);

            // Log to action log
            var actionLog = new ScheduleActionLog
            {
                DoorID = door.DoorID,
                ActionType = action.ToUpper(),
                ActionTime = DateTime.UtcNow,
                TriggeredBy = "Manual",
                Success = response.Success,
                VIAResponseCode = response.StatusCode,
                VIAResponseBody = response.ResponseBody,
                ErrorMessage = response.ErrorMessage
            };

            _dbContext.ScheduleActionLogs.Add(actionLog);
            await _dbContext.SaveChangesAsync();

            return Ok(new QuickControlsTestResult
            {
                Success = response.Success,
                DoorID = door.DoorID,
                DoorName = door.DoorName,
                Action = action,
                Timestamp = response.Timestamp,
                VIAResponseCode = response.StatusCode,
                ErrorMessage = response.ErrorMessage
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing Quick Controls for door {DoorId}", id);
            return StatusCode(500, new { error = "Quick Controls test failed", details = ex.Message });
        }
    }
}
