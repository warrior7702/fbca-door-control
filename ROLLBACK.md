# Rollback Instructions

**Checkpoint Created:** 2026-02-12 23:40 CST  
**Tag:** `v1.0-phase1-complete`  
**Commit:** 29e377c

---

## What's in This Checkpoint

✅ **Working Features:**
- Door unlock/lock via MonitorCast API
- Reader ID 122 (PCB-F2-DBL) tested and working
- Auto-deactivation after schedule completion
- Database logging (VIAResponseBody = "true")
- MonitorCast logs show "Reader Mode Changed" events

❌ **Known Issue:**
- Card/Pin schedules override unlock schedules (no priority system yet)

---

## How to Rollback (If Priority System Breaks)

### On Windows Server:

```powershell
cd C:\Projects\fbca-door-control

# Stop the running app (Ctrl+C)

# Fetch the rollback tag
git fetch origin --tags

# Checkout the checkpoint
git checkout v1.0-phase1-complete

# Create a new branch (optional, for safety)
git checkout -b rollback-from-priority-system

# Run the stable version
dotnet run
```

### On Mac (Development):

```bash
cd /Users/fbclaude/.openclaw/workspace/fbca-door-control

git fetch origin --tags
git checkout v1.0-phase1-complete
git checkout -b rollback-from-priority-system
```

---

## What Comes Next (After This Checkpoint)

**Implementing:** Schedule Priority System (Option 3)

**Changes planned:**
1. Add `Priority` column to `UnlockSchedules` table (database migration)
2. Update SchedulerService to check priorities before sending LOCK
3. UI updates to set priority when creating schedules
4. Migration script for existing schedules (default Priority=5)

**If it breaks:**
- Use the rollback steps above
- Report what broke in GitHub Issues
- We'll fix and test again

---

## Verifying Rollback Success

After rollback, test:
1. Create a simple unlock schedule (no overlaps)
2. Verify door unlocks at start time
3. Verify door locks at end time
4. Check database logs for Success=1, VIAResponseBody="true"

If these pass, you're on stable ground!

---

**Safe to proceed with priority system implementation! 🚀**
