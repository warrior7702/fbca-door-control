# Recurring Schedules - Deployment Guide

**Feature:** Automatically generate door unlock schedules from recurring patterns (weekly/biweekly/monthly)

**Test Case:** FLX gym area - Every Sunday 8:00 AM - 12:00 PM (low impact test)

---

## What We Built

### New Files
1. **Services/RecurrenceService.cs** - Core logic for pattern management & schedule generation
2. **Models/RecurrencePattern.cs** - Database models (already created last night)
3. **Test_FLX_Recurring.sql** - Test script to create FLX Sunday pattern

### Modified Files
1. **Services/SchedulerService.cs** - Added daily recurrence check
2. **Program.cs** - Registered RecurrenceService
3. **Data/DoorControlDbContext.cs** - Added DbSets for new entities

### Database Tables (Already Created)
- ✅ RecurrencePatterns
- ✅ RecurrencePatternDoors
- ✅ RecurrenceInstances

---

## Deployment Steps

### Step 1: Stop the Service
```powershell
# On server 10.5.5.31
net stop FBCADoorControl
```

### Step 2: Copy Updated Files
**From OneDrive to server:**

Copy these files from `OneDrive/FBCA Projects/door-control/` to `C:\path\to\fbca-door-control\`:
- `Services/RecurrenceService.cs` (NEW)
- `Services/SchedulerService.cs` (MODIFIED)
- `Program.cs` (MODIFIED)
- `Data/DoorControlDbContext.cs` (MODIFIED)

### Step 3: Rebuild the Application
```powershell
# In project directory
dotnet build

# Should see: Build succeeded. 0 Warning(s). 0 Error(s).
```

**If build fails:** Check error messages - might need to add `using` statements or fix namespaces.

### Step 4: Start the Service
```powershell
net start FBCADoorControl
```

**Check logs** to verify service started successfully.

---

## Testing - Part 1: Create FLX Pattern

### Run Test Script
```sql
-- In SQL Server Management Studio
-- Open: Test_FLX_Recurring.sql (from OneDrive documentation folder)
-- Execute against FBCADoorControl database
```

**Expected output:**
```
Found FLX door: ID = [number]
Created recurring pattern: ID = [number]
Linked pattern to FLX door

=== Recurring Pattern Created ===
Id  EventName              UnlockTime  LockTime  RecurrenceType  DayOfWeek  StartDate   GenerateWeeksAhead  IsActive
1   Sunday Morning Gym     08:00       12:00     Weekly          Sunday     2026-02-23  4                   1

=== Linked Doors ===
Id  DoorName               DoorID
1   [FLX door name]        [number]

✅ SUCCESS! Recurring pattern created.
```

### Verify Pattern in Database
```sql
-- Check the pattern was created
SELECT * FROM RecurrencePatterns;

-- Check door linkage
SELECT 
    rp.EventName,
    d.DoorName
FROM RecurrencePatterns rp
JOIN RecurrencePatternDoors rpd ON rp.Id = rpd.RecurrencePatternId
JOIN Doors d ON rpd.DoorID = d.DoorID;
```

---

## Testing - Part 2: Generate Instances

### Option A: Restart Service (Easiest)
```powershell
# Restart triggers daily recurrence check
net stop FBCADoorControl
net start FBCADoorControl
```

**Check service logs** - should see:
```
[Timestamp] info: Running daily recurrence pattern check
[Timestamp] info: Generated 4 schedule instances from recurring patterns
```

### Option B: Wait for Daily Check
- Service checks once per day (first loop after midnight)
- Or wait until tomorrow morning

### Verify Instances Generated
```sql
-- Check UnlockSchedules table
SELECT 
    s.ScheduleID,
    s.ScheduleName,
    s.StartTime,
    s.EndTime,
    s.Source,
    s.IsRecurring,
    d.DoorName
FROM UnlockSchedules s
JOIN Doors d ON s.DoorID = d.DoorID
WHERE s.ScheduleName = 'Sunday Morning Gym'
ORDER BY s.StartTime;

-- Should see 4 rows (4 Sundays):
-- 2026-02-23 08:00:00 -> 2026-02-23 12:00:00
-- 2026-03-02 08:00:00 -> 2026-03-02 12:00:00
-- 2026-03-09 08:00:00 -> 2026-03-09 12:00:00
-- 2026-03-16 08:00:00 -> 2026-03-16 12:00:00
```

---

## Testing - Part 3: Verify Calendar UI

### Check Calendar
1. Open: `http://100.123.239.124:5002`
2. Navigate to February/March 2026
3. Look for **4 Sundays** with "Sunday Morning Gym (1 door)" events
4. Click an event → verify details show FLX door

**Expected:**
- Feb 23, Mar 2, Mar 9, Mar 16 all show the event
- Each event is 8:00 AM - 12:00 PM
- Event detail shows "FLX" door name

---

## Testing - Part 4: Wait for Sunday (Real Test)

### This Sunday (Feb 23, 2026)
**At 8:00 AM:**
- FLX door should unlock automatically
- Check ScheduleActionLogs for UNLOCK action
- Verify door is physically unlocked

**At 12:00 PM:**
- FLX door should lock automatically
- Check ScheduleActionLogs for LOCK action
- Verify door is physically locked

### Verify Actions
```sql
SELECT 
    ActionID,
    ActionType,
    ActionTime,
    Success,
    d.DoorName
FROM ScheduleActionLogs sal
JOIN Doors d ON sal.DoorID = d.DoorID
WHERE ActionTime >= '2026-02-23'
ORDER BY ActionTime DESC;
```

---

## Rollback Plan (If Needed)

### If Something Goes Wrong:

**Step 1: Stop Service**
```powershell
net stop FBCADoorControl
```

**Step 2: Remove Test Pattern**
```sql
-- Delete the test pattern (cascades to instances)
DELETE FROM RecurrencePatterns WHERE EventName = 'Sunday Morning Gym';

-- Manually delete generated schedules if needed
DELETE FROM UnlockSchedules WHERE ScheduleName = 'Sunday Morning Gym';
```

**Step 3: Restore Old Files**
- Restore previous versions of modified files from git/backup
- Rebuild: `dotnet build`
- Start service: `net start FBCADoorControl`

---

## Success Criteria

✅ **Phase 1: Setup**
- Service starts without errors
- Pattern created in database
- 4 schedules generated

✅ **Phase 2: Calendar UI**
- 4 Sunday events visible
- Event details correct

✅ **Phase 3: Execution**
- FLX unlocks at 8:00 AM on Sunday
- FLX locks at 12:00 PM on Sunday
- Action logs show successful operations

✅ **Phase 4: Ongoing**
- Each week, new Sunday schedule auto-generates
- Pattern continues for 4 weeks ahead
- No manual intervention needed

---

## Next Steps After Successful Test

1. **Add More Patterns** - Other recurring events (Wednesday night, etc.)
2. **Build UI** - "Create Recurring Schedule" button in calendar
3. **API Endpoints** - RESTful API for pattern management
4. **Multi-door Support** - Test with multiple buildings
5. **Custom Times** - Per-door time overrides

---

## Troubleshooting

### Service Won't Start
- Check logs: `C:\path\to\logs\`
- Verify database connection string
- Check for compilation errors

### No Schedules Generated
- Verify pattern is Active (`IsActive = 1`)
- Check service logs for errors
- Manually trigger: restart service

### Wrong Doors/Times
- Check RecurrencePatternDoors table
- Verify UnlockTime/LockTime in pattern
- Re-run generation after fixing pattern

### Schedules Not Executing
- Check SchedulerService is running
- Verify door IsActive in Doors table
- Check MonitorCast session (30-minute timeout)

---

**Ready to deploy?** Follow steps 1-4, then run the test script! 🚀
