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

    public SchedulerService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<SchedulerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _checkIntervalSeconds = configuration.GetValue<int>("Scheduler:CheckIntervalSeconds", 30);
        _gracePeriodMinutes = configuration.GetValue<int>("Scheduler:ActionGracePeriodMinutes", 5);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Scheduler service starting (check interval: {Interval}s, grace period: {Grace}min)",
            _checkIntervalSeconds, _gracePeriodMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndExecuteSchedulesAsync();
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

    private async Task CheckAndExecuteSchedulesAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<DoorControlDbContext>();
        var quickControls = scope.ServiceProvider.GetRequiredService<IQuickControlsService>();

        var now = DateTime.UtcNow;
        var gracePeriod = TimeSpan.FromMinutes(_gracePeriodMinutes);

        _logger.LogDebug("Checking schedules at {Time}", now);

        // Find schedules needing UNLOCK (start time passed, not yet unlocked)
        // Note: Load all active schedules first, then filter in memory for recent actions
        // (EF can't translate HasRecentUnlock method to SQL)
        var allActiveUnlockSchedules = await dbContext.UnlockSchedules
            .Include(s => s.Door)
            .Where(s => s.IsActive
                     && s.StartTime <= now
                     && s.EndTime > now)
            .ToListAsync();

        // Filter out schedules that have recent unlock actions (in-memory filter)
        var unlockSchedules = allActiveUnlockSchedules
            .Where(s => !HasRecentUnlock(dbContext, s.ScheduleID, s.DoorID, now, gracePeriod))
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

            _logger.LogInformation(
                "Executing UNLOCK for schedule {ScheduleId}: Door {DoorName} (VIA Device {DeviceId})",
                schedule.ScheduleID, schedule.Door.DoorName, schedule.Door.VIADeviceID);

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

            _logger.LogInformation(
                "Executing LOCK for schedule {ScheduleId}: Door {DoorName} (VIA Device {DeviceId})",
                schedule.ScheduleID, schedule.Door.DoorName, schedule.Door.VIADeviceID);

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
}
