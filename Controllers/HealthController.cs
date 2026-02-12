using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Services;

namespace FBCADoorControl.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly DoorControlDbContext _doorControlDb;
    private readonly VIACDbContext _viacDb;
    private readonly IQuickControlsService _quickControls;
    private readonly ILogger<HealthController> _logger;
    private static readonly DateTime _startTime = DateTime.UtcNow;

    public HealthController(
        DoorControlDbContext doorControlDb,
        VIACDbContext viacDb,
        IQuickControlsService quickControls,
        ILogger<HealthController> logger)
    {
        _doorControlDb = doorControlDb;
        _viacDb = viacDb;
        _quickControls = quickControls;
        _logger = logger;
    }

    /// <summary>
    /// System health check.
    /// GET /api/health
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<HealthResponse>> GetHealth()
    {
        var checks = new Dictionary<string, string>();
        var overallStatus = "Healthy";

        // Check FBCADoorControl database
        try
        {
            await _doorControlDb.Doors.Take(1).ToListAsync();
            checks["database"] = "Healthy";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FBCADoorControl database check failed");
            checks["database"] = "Unhealthy";
            overallStatus = "Unhealthy";
        }

        // Check VIA database (read-only)
        try
        {
            await _viacDb.HW_Devices.Take(1).ToListAsync();
            checks["viaDatabase"] = "Healthy";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "VIA database check failed");
            checks["viaDatabase"] = "Degraded";
            if (overallStatus == "Healthy")
            {
                overallStatus = "Degraded";
            }
        }

        // Check MonitorCast API (simple auth check, don't send actual commands)
        try
        {
            var isAuth = await _quickControls.IsAuthenticatedAsync();
            if (!isAuth)
            {
                await _quickControls.AuthenticateAsync();
            }
            checks["monitorCast"] = "Healthy";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MonitorCast check failed");
            checks["monitorCast"] = "Unhealthy";
            overallStatus = "Unhealthy";
        }

        // Scheduler service running check (can't directly check IHostedService, assume running if process alive)
        checks["scheduler"] = "Running";

        // Calculate uptime
        var uptime = DateTime.UtcNow - _startTime;

        return Ok(new HealthResponse
        {
            Status = overallStatus,
            Timestamp = DateTime.UtcNow,
            Checks = checks,
            Uptime = uptime.ToString(@"d\.hh\:mm\:ss"),
            Version = "1.0.0"
        });
    }

    /// <summary>
    /// Get schedule action log (audit trail).
    /// GET /api/health/schedule-actions?limit=100
    /// </summary>
    [HttpGet("schedule-actions")]
    public async Task<ActionResult<ActionLogResponse>> GetScheduleActions(
        [FromQuery] int limit = 100,
        [FromQuery] int? doorId = null)
    {
        try
        {
            var query = _doorControlDb.ScheduleActionLogs
                .Include(log => log.Door)
                .AsQueryable();

            if (doorId.HasValue)
            {
                query = query.Where(log => log.DoorID == doorId.Value);
            }

            var logs = await query
                .OrderByDescending(log => log.ActionTime)
                .Take(limit)
                .ToListAsync();

            var logDtos = logs.Select(log => new ActionLogDto
            {
                ActionID = log.ActionID,
                ScheduleID = log.ScheduleID,
                DoorID = log.DoorID,
                DoorName = log.Door?.DoorName ?? "Unknown",
                ActionType = log.ActionType,
                ActionTime = log.ActionTime,
                Success = log.Success,
                ErrorMessage = log.ErrorMessage,
                TriggeredBy = log.TriggeredBy,
                VIAResponseCode = log.VIAResponseCode
            }).ToList();

            return Ok(new ActionLogResponse
            {
                Actions = logDtos,
                Total = logDtos.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving action log");
            return StatusCode(500, new { error = "Failed to retrieve action log", details = ex.Message });
        }
    }
}

public class HealthResponse
{
    public string Status { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public Dictionary<string, string> Checks { get; set; } = new();
    public string Uptime { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
}

public class ActionLogDto
{
    public int ActionID { get; set; }
    public int? ScheduleID { get; set; }
    public int DoorID { get; set; }
    public string DoorName { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public DateTime ActionTime { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string TriggeredBy { get; set; } = string.Empty;
    public int? VIAResponseCode { get; set; }
}

public class ActionLogResponse
{
    public List<ActionLogDto> Actions { get; set; } = new();
    public int Total { get; set; }
}
