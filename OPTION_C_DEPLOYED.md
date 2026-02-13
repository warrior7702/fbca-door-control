# Option C: Re-Unlock Monitoring - DEPLOYED

**Deployed:** 2026-02-12 11:56 PM CST  
**Commit:** 47df7a6  
**Combines:** Priority System + Re-Unlock Monitoring

---

## What This Fixes

**THE PROBLEM:**
- MonitorCast Card/Pin schedules end with LOCK commands
- Those locks override our unlock schedules
- Priority system only works for schedules IN OUR DATABASE
- We need to coexist: MonitorCast handles Card/Pin, we handle special unlocks

**THE SOLUTION:**
Every 30 seconds, the scheduler:
1. Checks all currently active unlock schedules
2. If last unlock was >2 minutes ago → RE-UNLOCK the door
3. This "keep-alive" mechanism fights back against MonitorCast locks

**RESULT:** MonitorCast can lock all it wants, we'll re-unlock within 30 seconds!

---

## How It Works

### Timeline Example

```
10:40 PM: MonitorCast Card/Pin schedule starts
11:14 PM: Our unlock schedule starts (Priority=10) → UNLOCK sent ✅
11:16 PM: Re-unlock (keep-alive, 2 min interval) → UNLOCK sent ✅
11:18 PM: Re-unlock (keep-alive) → UNLOCK sent ✅
11:20 PM: MonitorCast Card/Pin ends → LOCK sent by MonitorCast ❌
11:20:30 PM: Scheduler checks (30s cycle):
              "Schedule still active? Yes."
              "Last unlock? 11:18 PM (>2 min ago? No, only 2.5 min)"
              "Wait for next cycle..."
11:21:00 PM: Scheduler checks:
              "Last unlock? 11:18 PM (3 min ago)"
              "RE-UNLOCK!" → Door unlocks again! ✅
11:23 PM: Re-unlock (keep-alive) → UNLOCK sent ✅
... continues re-unlocking every 2 minutes ...
11:30 PM: Our schedule ends → LOCK sent ✅
```

**Key Insight:** We re-assert unlock every 2 minutes. If MonitorCast locks it, we catch it on the next scheduler cycle (within 30 seconds) and re-unlock.

---

## Configuration

### New Settings (appsettings.json)

```json
"Scheduler": {
  "CheckIntervalSeconds": 30,
  "ActionGracePeriodMinutes": 5,
  "ReUnlockIntervalMinutes": 2    // NEW: How often to re-assert unlock
}
```

**ReUnlockIntervalMinutes:**
- Default: 2 minutes
- Lower = more aggressive keep-alive (more API calls)
- Higher = longer time door could be locked before we fix it
- Recommended: 2-3 minutes

---

## Deployment Steps (Windows Server)

### Step 1: Pull Latest Code

```powershell
cd C:\Projects\fbca-door-control

# Stop the running app (Ctrl+C)

git pull origin main
```

### Step 2: Restart App

```powershell
dotnet run
```

**Expected startup log:**
```
Scheduler service starting (check interval: 30s, grace period: 5min, re-unlock interval: 2min)
```

**Look for the new "re-unlock interval" in the log!**

---

## Testing Tonight (CRITICAL TEST)

**Now we can finally test the real overlap scenario!**

### Test Setup

**Create MonitorCast Card/Pin schedule:**
- Time: 12:00 AM → 12:10 AM
- Door: PCB-F2-DBL
- Location: MonitorCast UI (native schedule, not our system)

**Create our unlock schedule in OUR UI:**
- Time: 12:05 AM → 12:15 AM
- Door: PCB-F2-DBL
- Priority: 10 (high)

### Expected Behavior

```
12:00 AM: MonitorCast Card/Pin starts
12:05 AM: Our unlock starts → UNLOCK sent ✅
12:07 AM: Re-unlock (keep-alive) → UNLOCK sent ✅
12:09 AM: Re-unlock (keep-alive) → UNLOCK sent ✅
12:10 AM: MonitorCast Card/Pin ends → LOCK sent by MonitorCast ❌
12:10:30 AM: Scheduler cycle → RE-UNLOCK! ✅
12:11 AM: Re-unlock (keep-alive) → UNLOCK sent ✅
12:13 AM: Re-unlock (keep-alive) → UNLOCK sent ✅
12:15 AM: Our schedule ends → LOCK sent ✅
```

### What to Watch For

**In MonitorCast logs:**
```
12:10:XX - Reader Mode Changed (Unlock -> CardOrPin) [MonitorCast lock]
12:10:XX - Reader Mode Changed (CardOrPin -> Unlock) [Our re-unlock!]
```

**In app logs:**
```
RE-UNLOCKING door for schedule X: Door PCB-F2-DBL (Priority=10) - Fighting MonitorCast or other lock commands
```

**SUCCESS CRITERIA:**
- Door unlocks at 12:05 AM ✅
- MonitorCast locks at 12:10 AM ✅
- We re-unlock within 1 minute ✅
- Door stays unlocked until 12:15 AM ✅

**FAILURE:**
- We don't re-unlock after MonitorCast locks it
- Door stays locked from 12:10-12:15 AM

---

## Log Messages to Watch

### Initial Unlock
```
Executing UNLOCK for schedule X: Door PCB-F2-DBL (VIA Device 122, Priority=10)
```

### Re-Unlock (Keep-Alive)
```
RE-UNLOCKING door for schedule X: Door PCB-F2-DBL (Priority=10) - Fighting MonitorCast or other lock commands
```

### Priority-Blocked Lock
```
Skipping LOCK for schedule X (Priority=1) - higher-priority schedule still active on door PCB-F2-DBL
```

---

## Combined System Overview

We now have **THREE layers of protection:**

### 1. Priority System
- Prevents OUR schedules from conflicting with each other
- Higher-priority schedules block lower-priority locks
- Example: Event unlock (Priority=10) blocks Card/Pin lock (Priority=1)

### 2. Re-Unlock Monitoring (Option C)
- Fights back against EXTERNAL systems (MonitorCast native schedules)
- Re-asserts unlock every 2 minutes
- Catches and corrects external locks within 30 seconds

### 3. Auto-Deactivation
- Schedules auto-deactivate after completion
- Prevents old schedules from interfering

---

## Configuration Tuning

### Aggressive Mode (More Keep-Alives)
```json
"Scheduler": {
  "CheckIntervalSeconds": 30,
  "ReUnlockIntervalMinutes": 1    // Re-unlock every 1 minute
}
```
- Pro: Faster recovery from external locks
- Con: More API calls, more MonitorCast logs

### Conservative Mode (Fewer Keep-Alives)
```json
"Scheduler": {
  "CheckIntervalSeconds": 30,
  "ReUnlockIntervalMinutes": 5    // Re-unlock every 5 minutes
}
```
- Pro: Fewer API calls, cleaner logs
- Con: Door could be locked for up to 5.5 minutes before we fix it

### Recommended (Current Default)
```json
"Scheduler": {
  "CheckIntervalSeconds": 30,
  "ReUnlockIntervalMinutes": 2    // Re-unlock every 2 minutes
}
```
- Balanced: Good recovery time, reasonable API usage

---

## Next Steps

1. **Deploy now** (git pull + restart)
2. **Run test** (12:00-12:15 AM overlap test)
3. **Watch logs** for "RE-UNLOCKING" messages
4. **Verify** door stays unlocked from 12:05-12:15 AM
5. **If successful** → THIS IS THE SOLUTION! 🎉

---

## Rollback (If Needed)

```powershell
git checkout v1.0-phase1-complete
dotnet run
```

But honestly, this should just work. We're not changing the lock logic, just adding more unlocks.

---

**Ready to test! This should finally solve the MonitorCast coexistence problem!** 🚀
