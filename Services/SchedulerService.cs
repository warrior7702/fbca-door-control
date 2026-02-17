using Microsoft.EntityFrameworkCore;
using FBCADoorControl.Data;
using FBCADoorControl.Models;

namespace FBCADoorControl.Services;

/// <summary>
/// Background service that checks for due schedules every 30 seconds
/// and executes unlock/lock actions via MonitorCast Quick Controls.
/// </summary>
public class SchedulerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SchedulerService> _logger;
    private readonly int _checkIntervalSeconds;
    private readonly int _gracePeriodMinutes;
    private readonly int _reUnlockIntervalMinutes;

    public SchedulerService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<SchedulerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _checkIntervalSeconds = configuration.GetValue<int>("Scheduler:CheckIntervalSeconds", 30);
        _gracePeriodMinutes = configuration.GetValue<int>("Scheduler:ActionGracePeriodMinutes", 5);
        _reUnlockIntervalMinutes = configuration.GetValue<int>("Scheduler:ReUnlockIntervalMinutes", 2);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Scheduler service starting (check interval: {Interval}s, grace period: {Grace}min, re-unlock interval: {ReUnlock}min)",
            _checkIntervalSeconds, _gracePeriodMinutes, _reUnlockIntervalMinutes);

        DateTime lastRecurrenceCheck = DateTime.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Check schedules every loop (30 seconds)
                await CheckAndExecuteSchedulesAsync();

                // Generate recurring schedule instances once per day (at midnight or first check after)
                var today = DateTime.Today;
                if (lastRecurrenceCheck.Date < today)
                {
                    _logger.LogInformation("Running daily recurrence pattern check");
                    await GenerateRecurringSchedulesAsync();
                    lastRecurrenceCheck = DateTime.Now;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in scheduler loop");
            }

            // Wait before next check
            await Task.Delay(TimeSpan.FromSeconds(_checkIntervalSeconds), stoppingToken);
        }

        _logger.LogInformation("Scheduler service stopping");
    }

    /// <summary>
    /// Generate schedule instances for all active recurring patterns.
    /// Called once per day by the scheduler.
    /// </summary>
    private async Task GenerateRecurringSchedulesAsync()
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var recurrenceService = scope.ServiceProvider.GetRequiredService<RecurrenceService>();
            
            var generated = await recurrenceService.GenerateScheduleInstancesAsync();
            
            if (generated > 0)
            {
                _logger.LogInformation("Generated {Count} schedule instances from recurring patterns", generated);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating recurring schedules");
        }
    }

    private async Task CheckAndExecuteSchedulesAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DoorControlDbContext>();
        var quickControls = scope.ServiceProvider.GetRequiredService<IQuickControlsService>();

        var now = DateTime.UtcNow;
        var gracePeriod = TimeSpan.FromMinutes(_gracePeriodMinutes);
        var reUnlockInterval = TimeSpan.FromMinutes(_reUnlockIntervalMinutes);

        _logger.LogDebug("Checking schedules at {Time}", now);

        // OPTION C: RE-UNLOCK MONITORING
        // Find ALL currently active schedules (StartTime <= now < EndTime)
        // Re-unlock if last unlock was more than reUnlockInterval ago
        // This fights back against MonitorCast Card/Pin schedules that lock our doors
        var allActiveUnlockSchedules = await dbContext.UnlockSchedules
            .Include(s => s.Door)
            .Where(s => s.IsActive
                     && s.StartTime <= now
                     && s.EndTime > now)
            .ToListAsync();

        // Filter: Only unlock if last unlock was MORE than reUnlockInterval ago
        // This means we re-assert unlock every 2 minutes to fight MonitorCast locks
        var unlockSchedules = allActiveUnlockSchedules
            .Where(s => !HasRecentUnlock(dbContext, s.ScheduleID, s.DoorID, now, reUnlockInterval))
            .ToList();

        foreach (var schedule in unlockSchedules)
        {
            if (schedule.Door == null || !schedule.Door.IsActive)
            {
                _logger.LogWarning(
                    "Skipping schedule {ScheduleId} - door {DoorId} is inactive or not found",
                    schedule.ScheduleID, schedule.DoorID);
                continue;
            }

            // Determine if this is initial unlock or re-unlock (keep-alive)
            var lastUnlock = GetLastUnlockTime(dbContext, schedule.ScheduleID, schedule.DoorID);
            var isReUnlock = lastUnlock.HasValue && lastUnlock.Value < now.AddMinutes(-1);

            if (isReUnlock)
            {
                _logger.LogInformation(
                    "RE-UNLOCKING door for schedule {ScheduleId}: Door {DoorName} (Priority={Priority}) - " +
                    "Fighting MonitorCast or other lock commands",
                    schedule.ScheduleID, schedule.Door.DoorName, schedule.Priority);
            }
            else
            {
                _logger.LogInformation(
                    "Executing UNLOCK for schedule {ScheduleId}: Door {DoorName} (VIA Device {DeviceId}, Priority={Priority})",
                    schedule.ScheduleID, schedule.Door.DoorName, schedule.Door.VIADeviceID, schedule.Priority);
            }

            await ExecuteScheduleActionAsync(
                dbContext, quickControls, schedule, "UNLOCK");
        }

        // Find schedules needing LOCK (end time passed, not yet locked)
        // Note: Load all schedules past end time first, then filter in memory for recent actions
        // (EF can't translate HasRecentLock method to SQL)
        var allExpiredSchedules = await dbContext.UnlockSchedules
            .Include(s => s.Door)
            .Where(s => s.IsActive
                     && s.EndTime <= now)
            .ToListAsync();

        // Filter out schedules that have recent lock actions (in-memory filter)
        var lockSchedules = allExpiredSchedules
            .Where(s => !HasRecentLock(dbContext, s.ScheduleID, s.DoorID, now, gracePeriod))
            .ToList();

        foreach (var schedule in lockSchedules)
        {
            if (schedule.Door == null || !schedule.Door.IsActive)
            {
                _logger.LogWarning(
                    "Skipping schedule {ScheduleId} - door {DoorId} is inactive or not found",
                    schedule.ScheduleID, schedule.DoorID);
                continue;
            }

            // PRIORITY CHECK: Don't lock if higher-priority schedules are still active
            if (HasHigherPriorityScheduleActive(dbContext, schedule.DoorID, schedule.Priority, now))
            {
                _logger.LogInformation(
                    "Skipping LOCK for schedule {ScheduleId} (Priority={Priority}) - " +
                    "higher-priority schedule still active on door {DoorName}",
                    schedule.ScheduleID, schedule.Priority, schedule.Door.DoorName);
                
                // Still deactivate this schedule (it's expired), but don't send lock
                schedule.IsActive = false;
                await dbContext.SaveChangesAsync();
                continue;
            }

            _logger.LogInformation(
                "Executing LOCK for schedule {ScheduleId}: Door {DoorName} (VIA Device {DeviceId}, Priority={Priority})",
                schedule.ScheduleID, schedule.Door.DoorName, schedule.Door.VIADeviceID, schedule.Priority);

            await ExecuteScheduleActionAsync(
                dbContext, quickControls, schedule, "LOCK");

            // Deactivate schedule after lock (completed)
            schedule.IsActive = false;
            await dbContext.SaveChangesAsync();
            
            _logger.LogInformation(
                "Schedule {ScheduleId} completed and deactivated",
                schedule.ScheduleID);
        }
    }

    private async Task ExecuteScheduleActionAsync(
        DoorControlDbContext dbContext,
        IQuickControlsService quickControls,
        UnlockSchedule schedule,
        string actionType)
    {
        var actionLog = new ScheduleActionLog
        {
            ScheduleID = schedule.ScheduleID,
            DoorID = schedule.DoorID,
            ActionType = actionType,
            ActionTime = DateTime.UtcNow,
            TriggeredBy = "Schedule"
        };

        try
        {
            // Execute the action via Quick Controls
            var response = await quickControls.ExecuteActionAsync(
                schedule.Door.VIADeviceID,
                actionType.ToLower());

            actionLog.Success = response.Success;
            actionLog.VIAResponseCode = response.StatusCode;
            actionLog.VIAResponseBody = response.ResponseBody;

            if (!response.Success)
            {
                actionLog.ErrorMessage = response.ErrorMessage;
                _logger.LogError(
                    "Failed to {Action} door {DoorId}: {Error}",
                    actionType, schedule.DoorID, response.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Exception executing {Action} for schedule {ScheduleId}",
                actionType, schedule.ScheduleID);

            actionLog.Success = false;
            actionLog.ErrorMessage = ex.Message;
        }
        finally
        {
            // Always log the action (audit trail)
            dbContext.ScheduleActionLogs.Add(actionLog);
            await dbContext.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Check if there's been a recent UNLOCK action for this schedule/door.
    /// Prevents duplicate unlocks (idempotency).
    /// </summary>
    private bool HasRecentUnlock(
        DoorControlDbContext dbContext,
        int scheduleId,
        int doorId,
        DateTime now,
        TimeSpan gracePeriod)
    {
        var cutoff = now - gracePeriod;
        
        return dbContext.ScheduleActionLogs
            .Any(log => log.ScheduleID == scheduleId
                     && log.DoorID == doorId
                     && log.ActionType == "UNLOCK"
                     && log.Success
                     && log.ActionTime >= cutoff);
    }

    /// <summary>
    /// Check if there's been a recent LOCK action for this schedule/door.
    /// Prevents duplicate locks (idempotency).
    /// </summary>
    private bool HasRecentLock(
        DoorControlDbContext dbContext,
        int scheduleId,
        int doorId,
        DateTime now,
        TimeSpan gracePeriod)
    {
        var cutoff = now - gracePeriod;
        
        return dbContext.ScheduleActionLogs
            .Any(log => log.ScheduleID == scheduleId
                     && log.DoorID == doorId
                     && log.ActionType == "LOCK"
                     && log.Success
                     && log.ActionTime >= cutoff);
    }

    /// <summary>
    /// Check if there are any active schedules with higher or equal priority on this door.
    /// Used to prevent lower-priority schedules from locking when higher-priority ones are active.
    /// Example: Card/Pin schedule (Priority=1) ending should NOT lock if Event unlock (Priority=10) is active.
    /// </summary>
    private bool HasHigherPriorityScheduleActive(
        DoorControlDbContext dbContext,
        int doorId,
        int currentPriority,
        DateTime now)
    {
        return dbContext.UnlockSchedules
            .Any(s => s.DoorID == doorId
                   && s.IsActive
                   && s.StartTime <= now
                   && s.EndTime > now
                   && s.Priority >= currentPriority);
    }

    /// <summary>
    /// Get the timestamp of the last successful unlock for this schedule/door.
    /// Used to determine if this is an initial unlock or a re-unlock (keep-alive).
    /// </summary>
    private DateTime? GetLastUnlockTime(
        DoorControlDbContext dbContext,
        int scheduleId,
        int doorId)
    {
        return dbContext.ScheduleActionLogs
            .Where(log => log.ScheduleID == scheduleId
                       && log.DoorID == doorId
                       && log.ActionType == "UNLOCK"
                       && log.Success)
            .OrderByDescending(log => log.ActionTime)
            .Select(log => log.ActionTime)
            .FirstOrDefault();
    }
}
