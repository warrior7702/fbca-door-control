# Deploy Priority System - Step by Step

**Created:** 2026-02-12 23:42 CST  
**Rollback Tag:** `v1.0-phase1-complete` (if this breaks)

---

## What This Does

**Fixes:** Card/Pin schedules no longer override Event unlocks!

**How:** Added Priority field to schedules. When a schedule ends and wants to LOCK, it checks if any higher-priority schedules are still active. If yes → skip the lock.

**Example:**
```
Card/Pin: 8 AM-6 PM (Priority=1)
Event: 5:30-7:30 PM (Priority=10)

6:00 PM: Card/Pin ends → checks Priority → sees 10 > 1 → SKIP LOCK ✅
7:30 PM: Event ends → no higher priorities → SEND LOCK ✅
```

---

## Deployment Steps (Windows Server)

### Step 1: Pull Latest Code

```powershell
cd C:\Projects\fbca-door-control

# Stop the running app (Ctrl+C in the terminal)

git pull origin main
```

### Step 2: Run Database Migration

```powershell
# Open SQL Server Management Studio (SSMS)
# OR use sqlcmd:

sqlcmd -S 127.0.0.1 -d FBCADoorControl -E -i ADD_PRIORITY_MIGRATION.sql
```

**Expected output:**
```
Migration complete! Priority column added to UnlockSchedules.
Priority levels: 1 (Card/Pin), 5 (Normal), 10 (Emergency)
```

### Step 3: Verify Migration

```sql
-- Check the new column exists
SELECT TOP 5 ScheduleID, DoorID, ScheduleName, Priority, IsActive
FROM UnlockSchedules;

-- Should show Priority=5 for all existing schedules
```

### Step 4: Start the App

```powershell
cd C:\Projects\fbca-door-control
dotnet run
```

**Watch for:**
```
Scheduler service starting (check interval: 30s, grace period: 5min)
```

---

## Testing the Priority System

### Test 1: Verify Existing Schedules Still Work

1. Create a simple unlock: 11:50 PM → 12:00 AM (no overlaps)
2. Verify door unlocks and locks correctly
3. Check logs: Should show Priority=5

### Test 2: The Critical Overlap Test (TOMORROW DAYTIME)

**Setup:**
1. Create MonitorCast Card/Pin schedule in our system:
   - Time: 8:00 AM → 11:00 AM
   - Door: PCB-F2-DBL
   - **Priority: 1** (low priority)

2. Create Event unlock schedule:
   - Time: 10:30 AM → 11:30 AM
   - Door: PCB-F2-DBL
   - **Priority: 10** (high priority)

**Expected behavior:**
```
8:00 AM: Card/Pin unlocks (Priority=1) ✅
10:30 AM: Event unlocks (Priority=10, redundant but fine) ✅
11:00 AM: Card/Pin ends → checks priorities → sees Priority 10 active → SKIP LOCK ✅
11:30 AM: Event ends → no higher priorities → SEND LOCK ✅
```

**Success criteria:**
- Door stays unlocked from 8:00 AM to 11:30 AM
- No lock at 11:00 AM (this was the bug!)
- Logs show "Skipping LOCK for schedule X - higher-priority schedule still active"

### Test 3: Same Priority (Tie)

**Setup:**
- Schedule A: 1:00 PM → 2:00 PM (Priority=5)
- Schedule B: 1:30 PM → 2:30 PM (Priority=5)

**Expected:**
```
1:00 PM: Schedule A unlocks ✅
1:30 PM: Schedule B unlocks (redundant) ✅
2:00 PM: Schedule A ends → checks priorities → sees Priority 5 active (tie) → SKIP LOCK ✅
2:30 PM: Schedule B ends → SEND LOCK ✅
```

---

## Priority Levels Reference

| Priority | Use Case | Description |
|----------|----------|-------------|
| 1 | Card/Pin Access | Low priority, represents MonitorCast Card/Pin schedules migrated to our system |
| 5 | Normal Unlock | Default priority for most unlock schedules |
| 10 | Emergency/Event | High priority, cannot be overridden by Card/Pin or normal unlocks |

**Rule:** Higher number = higher priority. When checking, we use `>=` so equal priorities also block locks.

---

## Rollback (If Something Breaks)

```powershell
cd C:\Projects\fbca-door-control

# Stop the app (Ctrl+C)

# Checkout the stable tag
git fetch origin --tags
git checkout v1.0-phase1-complete

# Remove the Priority column (optional, for clean rollback)
sqlcmd -S 127.0.0.1 -d FBCADoorControl -E -Q "ALTER TABLE UnlockSchedules DROP COLUMN Priority;"

# Run the stable version
dotnet run
```

---

## What Changed (Technical Details)

**Files modified:**
- `Models/UnlockSchedule.cs` - Added Priority field (int, default 5)
- `Services/SchedulerService.cs` - Added HasHigherPriorityScheduleActive() check before LOCK
- Database: UnlockSchedules table now has Priority column

**Logic added:**
```csharp
// Before sending LOCK:
if (HasHigherPriorityScheduleActive(dbContext, doorId, currentPriority, now))
{
    // Skip lock, log why, deactivate schedule but don't send command
    continue;
}
```

**Logs to watch for:**
- `"Executing LOCK for schedule X (Priority=Y)"`
- `"Skipping LOCK for schedule X (Priority=Y) - higher-priority schedule still active"`

---

## Next Steps After Deployment

1. Run Test 1 (simple schedule) tonight
2. Run Test 2 (overlap test) tomorrow morning
3. If Test 2 passes → PROBLEM SOLVED! 🎉
4. Document which doors have MonitorCast schedules that need Priority=1
5. Create UI dropdown for Priority when creating schedules (Phase 2 enhancement)

---

**Ready to deploy! This should fix the Card/Pin override issue! 🚀**
