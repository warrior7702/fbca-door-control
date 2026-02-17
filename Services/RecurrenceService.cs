using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Models;

namespace FBCADoorControl.Services;

/// <summary>
/// Service for managing recurring schedule patterns and generating schedule instances.
/// </summary>
public class RecurrenceService
{
    private readonly DoorControlDbContext _context;
    private readonly ILogger<RecurrenceService> _logger;

    public RecurrenceService(DoorControlDbContext context, ILogger<RecurrenceService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Generate schedule instances for all active recurring patterns.
    /// Should be called daily by the SchedulerService.
    /// </summary>
    public async Task<int> GenerateScheduleInstancesAsync()
    {
        var activePatterns = await _context.Set<RecurrencePattern>()
            .Include(p => p.Doors)
                .ThenInclude(pd => pd.Door)
            .Where(p => p.IsActive)
            .ToListAsync();

        if (!activePatterns.Any())
        {
            _logger.LogInformation("No active recurrence patterns found");
            return 0;
        }

        int totalGenerated = 0;

        foreach (var pattern in activePatterns)
        {
            try
            {
                var generated = await GenerateInstancesForPatternAsync(pattern);
                totalGenerated += generated;
                
                if (generated > 0)
                {
                    _logger.LogInformation(
                        "Generated {Count} schedule instances for pattern '{PatternName}' (ID: {PatternId})",
                        generated, pattern.EventName, pattern.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, 
                    "Error generating instances for pattern '{PatternName}' (ID: {PatternId})", 
                    pattern.EventName, pattern.Id);
            }
        }

        if (totalGenerated > 0)
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("Total schedule instances generated: {Count}", totalGenerated);
        }

        return totalGenerated;
    }

    /// <summary>
    /// Generate schedule instances for a specific recurring pattern.
    /// </summary>
    private async Task<int> GenerateInstancesForPatternAsync(RecurrencePattern pattern)
    {
        if (!pattern.Doors.Any())
        {
            _logger.LogWarning("Pattern '{PatternName}' has no doors assigned", pattern.EventName);
            return 0;
        }

        var today = DateTime.Today;
        var endDate = today.AddDays(pattern.GenerateWeeksAhead * 7);

        // Get existing instances to avoid duplicates
        var existingDates = await _context.Set<RecurrenceInstance>()
            .Where(i => i.RecurrencePatternId == pattern.Id)
            .Where(i => i.ScheduledDate >= today && i.ScheduledDate <= endDate)
            .Select(i => i.ScheduledDate)
            .ToListAsync();

        int generated = 0;
        var currentDate = pattern.GetNextOccurrence(today);

        while (currentDate.HasValue && currentDate.Value <= endDate)
        {
            // Skip if already generated
            if (existingDates.Contains(currentDate.Value.Date))
            {
                currentDate = pattern.GetNextOccurrence(currentDate.Value.AddDays(1));
                continue;
            }

            // Generate schedule for each door in the pattern
            foreach (var patternDoor in pattern.Doors)
            {
                var unlockTime = patternDoor.CustomUnlockTime ?? pattern.UnlockTime;
                var lockTime = patternDoor.CustomLockTime ?? pattern.LockTime;

                var schedule = new UnlockSchedule
                {
                    DoorID = patternDoor.DoorID,
                    ScheduleName = pattern.EventName,
                    StartTime = currentDate.Value.Date.Add(unlockTime),
                    EndTime = currentDate.Value.Date.Add(lockTime),
                    Source = "Recurring",
                    RecurrencePattern = pattern.RecurrenceType,
                    IsActive = true,
                    IsRecurring = true,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Set<UnlockSchedule>().Add(schedule);
                await _context.SaveChangesAsync(); // Save to get ScheduleID

                // Track the generated instance
                var instance = new RecurrenceInstance
                {
                    RecurrencePatternId = pattern.Id,
                    ScheduleID = schedule.ScheduleID,
                    ScheduledDate = currentDate.Value.Date,
                    GeneratedAt = DateTime.UtcNow
                };

                _context.Set<RecurrenceInstance>().Add(instance);
                
                // Update the schedule to link back to the instance
                schedule.RecurrenceInstanceId = instance.Id;
                
                generated++;
            }

            // Move to next occurrence
            currentDate = pattern.GetNextOccurrence(currentDate.Value.AddDays(1));
        }

        return generated;
    }

    /// <summary>
    /// Create a new recurring pattern with associated doors.
    /// </summary>
    public async Task<RecurrencePattern> CreatePatternAsync(
        string eventName,
        TimeSpan unlockTime,
        TimeSpan lockTime,
        string recurrenceType,
        int? dayOfWeek,
        int? dayOfMonth,
        DateTime startDate,
        DateTime? endDate,
        int generateWeeksAhead,
        List<int> doorIds,
        string? createdBy = null)
    {
        var pattern = new RecurrencePattern
        {
            EventName = eventName,
            UnlockTime = unlockTime,
            LockTime = lockTime,
            RecurrenceType = recurrenceType,
            DayOfWeek = dayOfWeek,
            DayOfMonth = dayOfMonth,
            StartDate = startDate.Date,
            EndDate = endDate?.Date,
            GenerateWeeksAhead = generateWeeksAhead,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };

        _context.Set<RecurrencePattern>().Add(pattern);
        await _context.SaveChangesAsync();

        // Add doors
        foreach (var doorId in doorIds)
        {
            var patternDoor = new RecurrencePatternDoor
            {
                RecurrencePatternId = pattern.Id,
                DoorID = doorId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Set<RecurrencePatternDoor>().Add(patternDoor);
        }

        await _context.SaveChangesAsync();

        // Generate initial instances
        await GenerateInstancesForPatternAsync(pattern);

        _logger.LogInformation(
            "Created recurring pattern '{EventName}' (ID: {PatternId}) with {DoorCount} doors",
            eventName, pattern.Id, doorIds.Count);

        return pattern;
    }

    /// <summary>
    /// Get all recurring patterns with their doors.
    /// </summary>
    public async Task<List<RecurrencePattern>> GetAllPatternsAsync()
    {
        return await _context.Set<RecurrencePattern>()
            .Include(p => p.Doors)
                .ThenInclude(pd => pd.Door)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    /// <summary>
    /// Get a specific pattern by ID.
    /// </summary>
    public async Task<RecurrencePattern?> GetPatternByIdAsync(int id)
    {
        return await _context.Set<RecurrencePattern>()
            .Include(p => p.Doors)
                .ThenInclude(pd => pd.Door)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    /// <summary>
    /// Delete a recurring pattern and optionally its generated instances.
    /// </summary>
    public async Task<bool> DeletePatternAsync(int id, bool deleteGeneratedSchedules = false)
    {
        var pattern = await GetPatternByIdAsync(id);
        if (pattern == null)
            return false;

        if (deleteGeneratedSchedules)
        {
            // Delete all generated schedules
            var instances = await _context.Set<RecurrenceInstance>()
                .Where(i => i.RecurrencePatternId == id)
                .Include(i => i.Schedule)
                .ToListAsync();

            foreach (var instance in instances)
            {
                if (instance.Schedule != null)
                {
                    _context.Set<UnlockSchedule>().Remove(instance.Schedule);
                }
            }
        }

        _context.Set<RecurrencePattern>().Remove(pattern);
        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Deleted recurring pattern '{EventName}' (ID: {PatternId}), deleteSchedules: {DeleteSchedules}",
            pattern.EventName, id, deleteGeneratedSchedules);

        return true;
    }
}
