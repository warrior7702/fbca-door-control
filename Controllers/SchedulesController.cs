using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Models;
using FBCADoorControl.Models.DTOs;

namespace FBCADoorControl.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SchedulesController : ControllerBase
{
    private readonly DoorControlDbContext _dbContext;
    private readonly ILogger<SchedulesController> _logger;

    public SchedulesController(
        DoorControlDbContext dbContext,
        ILogger<SchedulesController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Get currently active schedules (doors that should be unlocked RIGHT NOW).
    /// GET /api/schedules/active
    /// Returns all schedules where StartTime <= Now <= EndTime and IsActive = true
    /// </summary>
    [HttpGet("active")]
    public async Task<ActionResult<ActiveSchedulesResponse>> GetActiveSchedules()
    {
        try
        {
            var now = DateTime.UtcNow;
            
            var activeSchedules = await _dbContext.UnlockSchedules
                .Include(s => s.Door)
                .Where(s => s.IsActive 
                    && s.StartTime <= now 
                    && s.EndTime >= now)
                .OrderBy(s => s.Door.DoorName)
                .ToListAsync();

            var doorIds = activeSchedules.Select(s => s.DoorID).Distinct().ToList();
            
            return Ok(new ActiveSchedulesResponse
            {
                Timestamp = now,
                UnlockedDoorCount = doorIds.Count,
                UnlockedDoorIds = doorIds,
                Schedules = activeSchedules.Select(s => new ActiveScheduleDto
                {
                    ScheduleID = s.ScheduleID,
                    DoorID = s.DoorID,
                    DoorName = s.Door?.DoorName ?? "Unknown",
                    ScheduleName = s.ScheduleName,
                    StartTime = DateTime.SpecifyKind(s.StartTime, DateTimeKind.Utc),
                    EndTime = DateTime.SpecifyKind(s.EndTime, DateTimeKind.Utc),
                    MinutesRemaining = (int)(s.EndTime - now).TotalMinutes
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active schedules");
            return StatusCode(500, new { error = "Failed to retrieve active schedules", details = ex.Message });
        }
    }

    /// <summary>
    /// Get upcoming schedules for all doors (next event per door).
    /// GET /api/schedules/upcoming
    /// Returns the next scheduled event for each door that has future schedules.
    /// </summary>
    [HttpGet("upcoming")]
    public async Task<ActionResult<UpcomingSchedulesResponse>> GetUpcomingSchedules()
    {
        try
        {
            var now = DateTime.UtcNow;
            
            // Get all active schedules that start in the future
            var upcomingSchedules = await _dbContext.UnlockSchedules
                .Include(s => s.Door)
                .Where(s => s.IsActive && s.StartTime > now)
                .OrderBy(s => s.DoorID)
                .ThenBy(s => s.StartTime)
                .ToListAsync();

            // Group by door and take the earliest (next) schedule for each
            var nextSchedulePerDoor = upcomingSchedules
                .GroupBy(s => s.DoorID)
                .Select(g => g.First())
                .ToList();
            
            return Ok(new UpcomingSchedulesResponse
            {
                Timestamp = now,
                Schedules = nextSchedulePerDoor.Select(s => new UpcomingScheduleDto
                {
                    ScheduleID = s.ScheduleID,
                    DoorID = s.DoorID,
                    DoorName = s.Door?.DoorName ?? "Unknown",
                    ScheduleName = s.ScheduleName,
                    StartTime = DateTime.SpecifyKind(s.StartTime, DateTimeKind.Utc),
                    EndTime = DateTime.SpecifyKind(s.EndTime, DateTimeKind.Utc),
                    MinutesUntil = (int)(s.StartTime - now).TotalMinutes
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving upcoming schedules");
            return StatusCode(500, new { error = "Failed to retrieve upcoming schedules", details = ex.Message });
        }
    }

    /// <summary>
    /// Get list of unlock schedules with optional filtering.
    /// GET /api/schedules?doorId=5&isActive=true
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ScheduleListResponse>> GetSchedules(
        [FromQuery] int? doorId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] string? source = null)
    {
        try
        {
            var query = _dbContext.UnlockSchedules
                .Include(s => s.Door)
                .AsQueryable();

            if (doorId.HasValue)
            {
                query = query.Where(s => s.DoorID == doorId.Value);
            }

            if (startDate.HasValue)
            {
                query = query.Where(s => s.StartTime >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(s => s.EndTime <= endDate.Value);
            }

            if (isActive.HasValue)
            {
                query = query.Where(s => s.IsActive == isActive.Value);
            }

            if (!string.IsNullOrEmpty(source))
            {
                query = query.Where(s => s.Source == source);
            }

            var schedules = await query
                .OrderBy(s => s.StartTime)
                .ToListAsync();

            var scheduleDtos = schedules.Select(s => new ScheduleDto
            {
                ScheduleID = s.ScheduleID,
                DoorID = s.DoorID,
                DoorName = s.Door?.DoorName ?? "Unknown",
                ScheduleName = s.ScheduleName,
                // Explicitly specify these are UTC times so JSON serialization includes Z suffix
                StartTime = DateTime.SpecifyKind(s.StartTime, DateTimeKind.Utc),
                EndTime = DateTime.SpecifyKind(s.EndTime, DateTimeKind.Utc),
                RecurrencePattern = s.RecurrencePattern,
                RecurrenceEndDate = s.RecurrenceEndDate.HasValue 
                    ? DateTime.SpecifyKind(s.RecurrenceEndDate.Value, DateTimeKind.Utc) 
                    : null,
                Source = s.Source,
                IsActive = s.IsActive,
                IsRecurring = s.IsRecurring,
                EventType = s.EventType,
                Status = s.Status,
                CreatedAt = DateTime.SpecifyKind(s.CreatedAt, DateTimeKind.Utc)
            }).ToList();

            return Ok(new ScheduleListResponse
            {
                Schedules = scheduleDtos,
                Total = scheduleDtos.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving schedules");
            return StatusCode(500, new { error = "Failed to retrieve schedules", details = ex.Message });
        }
    }

    /// <summary>
    /// Get a specific schedule by ID.
    /// GET /api/schedules/1
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ScheduleDto>> GetSchedule(int id)
    {
        try
        {
            var schedule = await _dbContext.UnlockSchedules
                .Include(s => s.Door)
                .FirstOrDefaultAsync(s => s.ScheduleID == id);

            if (schedule == null)
            {
                return NotFound(new { error = "Schedule not found", scheduleId = id });
            }

            return Ok(new ScheduleDto
            {
                ScheduleID = schedule.ScheduleID,
                DoorID = schedule.DoorID,
                DoorName = schedule.Door?.DoorName ?? "Unknown",
                ScheduleName = schedule.ScheduleName,
                StartTime = DateTime.SpecifyKind(schedule.StartTime, DateTimeKind.Utc),
                EndTime = DateTime.SpecifyKind(schedule.EndTime, DateTimeKind.Utc),
                RecurrencePattern = schedule.RecurrencePattern,
                RecurrenceEndDate = schedule.RecurrenceEndDate.HasValue 
                    ? DateTime.SpecifyKind(schedule.RecurrenceEndDate.Value, DateTimeKind.Utc) 
                    : null,
                Source = schedule.Source,
                IsActive = schedule.IsActive,
                IsRecurring = schedule.IsRecurring,
                EventType = schedule.EventType,
                Status = schedule.Status,
                CreatedAt = DateTime.SpecifyKind(schedule.CreatedAt, DateTimeKind.Utc)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving schedule {ScheduleId}", id);
            return StatusCode(500, new { error = "Failed to retrieve schedule", details = ex.Message });
        }
    }

    /// <summary>
    /// Create a new unlock schedule (accepts door name or door ID).
    /// POST /api/schedules
    /// Body: { "doorId": 5, "doorName": "Main Entrance", "startTime": "2026-02-12T08:00:00Z", "endTime": "2026-02-12T17:00:00Z", ... }
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ScheduleCreateResponse>> CreateSchedule([FromBody] CreateScheduleRequest request)
    {
        try
        {
            // Validation
            if (request.EndTime <= request.StartTime)
            {
                return BadRequest(new { error = "End time must be after start time" });
            }

            // Resolve door (by ID or by name)
            Door? door = null;
            
            if (request.DoorId.HasValue)
            {
                door = await _dbContext.Doors.FindAsync(request.DoorId.Value);
            }
            else if (!string.IsNullOrEmpty(request.DoorName))
            {
                // Find door by name (case-insensitive, partial match)
                // Load all doors into memory then search (EF can't translate StringComparison)
                var allDoors = await _dbContext.Doors.ToListAsync();
                door = allDoors.FirstOrDefault(d => 
                    d.DoorName.Contains(request.DoorName, StringComparison.OrdinalIgnoreCase) ||
                    request.DoorName.Contains(d.DoorName, StringComparison.OrdinalIgnoreCase));
            }
            
            if (door == null)
            {
                return NotFound(new { 
                    error = "Door not found", 
                    doorId = request.DoorId, 
                    doorName = request.DoorName 
                });
            }

            if (!door.IsActive)
            {
                return BadRequest(new { error = "Door is not active", doorId = door.DoorID, doorName = door.DoorName });
            }

            // Check for duplicate schedule
            var existingSchedule = await _dbContext.UnlockSchedules
                .FirstOrDefaultAsync(s => 
                    s.DoorID == door.DoorID &&
                    s.StartTime == request.StartTime &&
                    s.EndTime == request.EndTime &&
                    s.ScheduleName == request.ScheduleName);

            if (existingSchedule != null)
            {
                return Conflict(new { 
                    error = "Schedule already exists", 
                    scheduleId = existingSchedule.ScheduleID,
                    message = $"A schedule for {door.DoorName} at this time already exists"
                });
            }

            // Create schedule
            var schedule = new UnlockSchedule
            {
                DoorID = door.DoorID,
                ScheduleName = request.ScheduleName,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                RecurrencePattern = request.RecurrencePattern ?? "NONE",
                RecurrenceEndDate = request.RecurrenceEndDate,
                Source = request.Source ?? "Manual",
                Priority = request.Priority ?? 5,
                EventType = request.EventType ?? "Special",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = request.Notes
            };

            _dbContext.UnlockSchedules.Add(schedule);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation(
                "Created schedule {ScheduleId} for door {DoorId}: {StartTime} - {EndTime}",
                schedule.ScheduleID, schedule.DoorID, schedule.StartTime, schedule.EndTime);

            return CreatedAtAction(
                nameof(GetSchedule),
                new { id = schedule.ScheduleID },
                new ScheduleCreateResponse
                {
                    ScheduleID = schedule.ScheduleID,
                    Message = "Schedule created successfully"
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating schedule");
            return StatusCode(500, new { error = "Failed to create schedule", details = ex.Message });
        }
    }

    /// <summary>
    /// Create multiple schedules for a multi-door event.
    /// POST /api/schedules/batch
    /// Body: { "eventName": "Sunday Service", "defaultStartTime": "...", "defaultEndTime": "...", "doors": [...] }
    /// </summary>
    [HttpPost("batch")]
    public async Task<ActionResult<BatchScheduleCreateResponse>> CreateBatchSchedules([FromBody] CreateBatchScheduleRequest request)
    {
        try
        {
            // Validation
            if (request.Doors == null || request.Doors.Count == 0)
            {
                return BadRequest(new { error = "At least one door must be specified" });
            }

            if (request.DefaultEndTime <= request.DefaultStartTime)
            {
                return BadRequest(new { error = "Default end time must be after start time" });
            }

            var createdSchedules = new List<int>();
            var errors = new List<string>();

            // Process each door
            foreach (var doorRequest in request.Doors)
            {
                try
                {
                    var door = await _dbContext.Doors.FindAsync(doorRequest.DoorId);
                    if (door == null)
                    {
                        errors.Add($"Door {doorRequest.DoorId} not found");
                        continue;
                    }

                    if (!door.IsActive)
                    {
                        errors.Add($"Door {doorRequest.DoorId} ({door.DoorName}) is not active");
                        continue;
                    }

                    // Use custom times if provided, otherwise use defaults
                    var startTime = doorRequest.CustomStartTime ?? request.DefaultStartTime;
                    var endTime = doorRequest.CustomEndTime ?? request.DefaultEndTime;

                    if (endTime <= startTime)
                    {
                        errors.Add($"Door {doorRequest.DoorId}: End time must be after start time");
                        continue;
                    }

                    // Create schedule
                    var schedule = new UnlockSchedule
                    {
                        DoorID = doorRequest.DoorId,
                        ScheduleName = request.EventName,
                        StartTime = startTime,
                        EndTime = endTime,
                        RecurrencePattern = request.RecurrencePattern ?? "NONE",
                        RecurrenceEndDate = request.RecurrenceEndDate,
                        Source = request.Source ?? "Multi-Door Event",
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };

                    _dbContext.UnlockSchedules.Add(schedule);
                    await _dbContext.SaveChangesAsync();

                    createdSchedules.Add(schedule.ScheduleID);

                    _logger.LogInformation(
                        "Created schedule {ScheduleId} for door {DoorId} ({DoorName}): {StartTime} - {EndTime}",
                        schedule.ScheduleID, door.DoorID, door.DoorName, schedule.StartTime, schedule.EndTime);
                }
                catch (Exception ex)
                {
                    errors.Add($"Door {doorRequest.DoorId}: {ex.Message}");
                    _logger.LogError(ex, "Error creating schedule for door {DoorId}", doorRequest.DoorId);
                }
            }

            if (createdSchedules.Count == 0)
            {
                return BadRequest(new 
                { 
                    error = "Failed to create any schedules", 
                    details = errors 
                });
            }

            return Ok(new BatchScheduleCreateResponse
            {
                Message = $"Created {createdSchedules.Count} schedule(s) for event '{request.EventName}'",
                ScheduleIds = createdSchedules,
                SuccessCount = createdSchedules.Count,
                ErrorCount = errors.Count,
                Errors = errors.Count > 0 ? errors : null
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating batch schedules");
            return StatusCode(500, new { error = "Failed to create batch schedules", details = ex.Message });
        }
    }

    /// <summary>
    /// Delete a schedule.
    /// DELETE /api/schedules/1
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSchedule(int id)
    {
        try
        {
            var schedule = await _dbContext.UnlockSchedules.FindAsync(id);

            if (schedule == null)
            {
                return NotFound(new { error = "Schedule not found", scheduleId = id });
            }

            _dbContext.UnlockSchedules.Remove(schedule);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Deleted schedule {ScheduleId}", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting schedule {ScheduleId}", id);
            return StatusCode(500, new { error = "Failed to delete schedule", details = ex.Message });
        }
    }
}
