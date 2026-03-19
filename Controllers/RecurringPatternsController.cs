using Microsoft.AspNetCore.Mvc;
using FBCADoorControl.Data;
using FBCADoorControl.Services;

namespace FBCADoorControl.Controllers;

[ApiController]
[Route("api/recurring-patterns")]
public class RecurringPatternsController : ControllerBase
{
    private readonly RecurrenceService _recurrenceService;
    private readonly DoorControlDbContext _dbContext;
    private readonly ILogger<RecurringPatternsController> _logger;

    public RecurringPatternsController(
        RecurrenceService recurrenceService,
        DoorControlDbContext dbContext,
        ILogger<RecurringPatternsController> logger)
    {
        _recurrenceService = recurrenceService;
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var patterns = await _recurrenceService.GetAllPatternsAsync();
        var result = patterns.Select(p => MapPatternToDto(p));
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var pattern = await _recurrenceService.GetPatternByIdAsync(id);
        if (pattern == null)
            return NotFound(new { error = $"Pattern {id} not found" });

        return Ok(MapPatternToDto(pattern));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePatternRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.EventName))
            return BadRequest(new { error = "EventName is required" });

        if (request.DoorIds == null || !request.DoorIds.Any())
            return BadRequest(new { error = "At least one door is required" });

        var pattern = await _recurrenceService.CreatePatternAsync(
            eventName: request.EventName,
            unlockTime: request.UnlockTime,
            lockTime: request.LockTime,
            recurrenceType: request.RecurrenceType ?? "Weekly",
            dayOfWeek: request.DayOfWeek,
            dayOfMonth: request.DayOfMonth,
            startDate: request.StartDate ?? DateTime.Today,
            endDate: request.EndDate,
            generateWeeksAhead: request.GenerateWeeksAhead ?? 4,
            doorIds: request.DoorIds,
            createdBy: request.CreatedBy,
            isSpecialEvent: request.IsSpecialEvent ?? false
        );

        _logger.LogInformation("Created pattern {Id} '{Name}' and generated initial instances", pattern.Id, pattern.EventName);

        return CreatedAtAction(nameof(GetById), new { id = pattern.Id }, MapPatternToDto(pattern));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePatternRequest request)
    {
        var pattern = await _recurrenceService.GetPatternByIdAsync(id);
        if (pattern == null)
            return NotFound(new { error = $"Pattern {id} not found" });

        if (request.EventName != null) pattern.EventName = request.EventName;
        if (request.UnlockTime.HasValue) pattern.UnlockTime = request.UnlockTime.Value;
        if (request.LockTime.HasValue) pattern.LockTime = request.LockTime.Value;
        if (request.RecurrenceType != null) pattern.RecurrenceType = request.RecurrenceType;
        if (request.DayOfWeek.HasValue) pattern.DayOfWeek = request.DayOfWeek.Value;
        if (request.DayOfMonth.HasValue) pattern.DayOfMonth = request.DayOfMonth.Value;
        if (request.IsActive.HasValue) pattern.IsActive = request.IsActive.Value;
        if (request.IsSpecialEvent.HasValue) pattern.IsSpecialEvent = request.IsSpecialEvent.Value;
        if (request.EndDate.HasValue) pattern.EndDate = request.EndDate.Value;

        pattern.ModifiedAt = DateTime.UtcNow;
        pattern.ModifiedBy = request.ModifiedBy;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Updated pattern {Id} '{Name}'", id, pattern.EventName);
        return Ok(MapPatternToDto(pattern));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] bool deleteGenerated = false)
    {
        var deleted = await _recurrenceService.DeletePatternAsync(id, deleteGenerated);
        if (!deleted)
            return NotFound(new { error = $"Pattern {id} not found" });

        return Ok(new { message = $"Pattern {id} deleted", deleteGeneratedSchedules = deleteGenerated });
    }

    [HttpPost("{id}/regenerate")]
    public async Task<IActionResult> Regenerate(int id)
    {
        var pattern = await _recurrenceService.GetPatternByIdAsync(id);
        if (pattern == null)
            return NotFound(new { error = $"Pattern {id} not found" });

        var count = await _recurrenceService.GenerateScheduleInstancesAsync();
        return Ok(new { message = $"Regenerated instances", totalGenerated = count });
    }

    private static object MapPatternToDto(Models.RecurrencePattern p) => new
    {
        p.Id,
        p.EventName,
        p.Description,
        UnlockTime = p.UnlockTime.ToString(@"hh\:mm"),
        LockTime = p.LockTime.ToString(@"hh\:mm"),
        p.RecurrenceType,
        p.DayOfWeek,
        p.DayOfMonth,
        p.WeekInterval,
        StartDate = p.StartDate.ToString("yyyy-MM-dd"),
        EndDate = p.EndDate?.ToString("yyyy-MM-dd"),
        p.GenerateWeeksAhead,
        p.IsActive,
        p.IsSpecialEvent,
        p.CreatedAt,
        p.CreatedBy,
        p.ModifiedAt,
        p.ModifiedBy,
        Doors = p.Doors?.Select(d => new
        {
            d.Id,
            d.DoorID,
            DoorName = d.Door?.DoorName,
            ControllerName = d.Door?.ControllerName,
            CustomUnlockTime = d.CustomUnlockTime?.ToString(@"hh\:mm"),
            CustomLockTime = d.CustomLockTime?.ToString(@"hh\:mm")
        })
    };

    public class CreatePatternRequest
    {
        public string EventName { get; set; } = string.Empty;
        public TimeSpan UnlockTime { get; set; }
        public TimeSpan LockTime { get; set; }
        public string? RecurrenceType { get; set; }
        public int? DayOfWeek { get; set; }
        public int? DayOfMonth { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? GenerateWeeksAhead { get; set; }
        public bool? IsSpecialEvent { get; set; }
        public List<int> DoorIds { get; set; } = new();
        public string? CreatedBy { get; set; }
    }

    public class UpdatePatternRequest
    {
        public string? EventName { get; set; }
        public TimeSpan? UnlockTime { get; set; }
        public TimeSpan? LockTime { get; set; }
        public string? RecurrenceType { get; set; }
        public int? DayOfWeek { get; set; }
        public int? DayOfMonth { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsSpecialEvent { get; set; }
        public DateTime? EndDate { get; set; }
        public string? ModifiedBy { get; set; }
    }
}
