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
    /// Create a new unlock schedule.
    /// POST /api/schedules
    /// Body: { "doorId": 5, "startTime": "2026-02-12T08:00:00Z", "endTime": "2026-02-12T17:00:00Z", ... }
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

            var door = await _dbContext.Doors.FindAsync(request.DoorId);
            if (door == null)
            {
                return NotFound(new { error = "Door not found", doorId = request.DoorId });
            }

            if (!door.IsActive)
            {
                return BadRequest(new { error = "Door is not active", doorId = request.DoorId });
            }

            // Create schedule
            var schedule = new UnlockSchedule
            {
                DoorID = request.DoorId,
                ScheduleName = request.ScheduleName,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                RecurrencePattern = request.RecurrencePattern ?? "NONE",
                RecurrenceEndDate = request.RecurrenceEndDate,
                Source = request.Source ?? "Manual",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
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
