# Critical Tests Before Production

**Last Updated:** 2026-02-12 21:56 CST

---

## Phase 1 Complete ✅

**Date:** February 12, 2026  
**Achievement:** First successful automated door unlock/lock via MonitorCast API  
**Test Door:** PCB-F2-DBL (Reader ID 122)  
**Evidence:**
- MonitorCast logs show "Reader Mode Changed" events at correct times
- Database logs show `VIAResponseBody = "true"` for all actions
- Physical door confirmed unlocking/locking

---

## Critical Test: Overlapping Schedule Priority

### The Problem (Current VIA/MonitorCast System)

**Billy's Pain Point (2/12/26):**
> "One of the biggest headaches with the current system is the linear commands. There is no Priority. For example if a card pin schedule is from 8 am to 6 pm and i want the doors open from 5:30 pm to 7:30pm the sequence would be 5:30 unlock, 6 pm the card would end locking the door and no other commands would fire."

**CRITICAL CLARIFICATION (2/12/26 11:13 PM):**
> "The majority of our schedules are card/pin and they interfere with unlock events"

**Key Insight:** Most MonitorCast schedules are **Card/Pin access** (doors respond to cards/badges), NOT full unlocks. When a Card/Pin schedule **ends**, it sends a LOCK command that overrides any active unlock schedules.

**Example Failure Scenario:**
```
Schedule A: Card/Pin access 8:00 AM → 6:00 PM (ends with LOCK at 6 PM)
Schedule B: Full unlock 5:30 PM → 7:30 PM

Timeline:
8:00 AM: Card/Pin access enabled (staff can use badges)
5:30 PM: Schedule B fully unlocks door (no badge needed)
6:00 PM: Schedule A ends, sends LOCK ❌ (overrides Schedule B!)
7:30 PM: Schedule B tries to lock (pointless, already locked)

Result: Door locked from 6:00-7:30 PM when it should be unlocked
```

**Why This Matters:**
- Card/Pin schedules are the norm (staff access all day)
- Special events need full unlocks (public access, no badges)
- Card/Pin ending should NOT override active unlocks
- Our system must be smarter than "last command wins"

### Why This Matters

- **Security risk:** Events could be locked out unexpectedly
- **Staff frustration:** Schedules don't work as intended
- **Trust issue:** System must be MORE reliable than current MonitorCast

### Live Test Tonight (2/12/26 11:14 PM)

**RUNNING NOW - Schedule 9 vs MonitorCast Card/Pin Schedule:**

```
MonitorCast: Card/Pin access 10:40 PM → 11:20 PM (PCB-F2-DBL)
Schedule 9:  Full unlock      11:14 PM → 11:30 PM (PCB-F2-DBL)

Timeline:
10:40 PM: Card/Pin access enabled
11:14 PM: Our system fully unlocks door
11:20 PM: MonitorCast Card/Pin ends → Expected LOCK (will kill our unlock!) 🚨
11:30 PM: Our schedule tries to lock (if door already locked by MonitorCast)
```

**Expected Result:** Door locks at 11:20 PM (failure case)  
**Desired Result:** Door stays unlocked until 11:30 PM  
**Status:** Watching live...

---

### Test Plan

**Test 1: Basic Overlap (Unlock During Unlock)**
```
Schedule A: 10:00 AM → 12:00 PM (unlock)
Schedule B: 11:00 AM → 1:00 PM (unlock)

Expected: Door unlocks at 10 AM, stays unlocked until 1 PM
```

**Test 2: Critical Overlap (Billy's Scenario)**
```
Schedule A: 8:00 AM → 6:00 PM (simulates card/pin schedule)
Schedule B: 5:30 PM → 7:30 PM (manual unlock for event)

Expected: Door unlocks at 8 AM, stays unlocked until 7:30 PM
Reality Check: Does Schedule A's 6 PM lock override Schedule B?
```

**Test 3: Multiple Overlaps**
```
Schedule A: 9:00 AM → 5:00 PM
Schedule B: 2:00 PM → 6:00 PM
Schedule C: 4:00 PM → 8:00 PM

Expected: Door unlocks at 9 AM, stays unlocked until 8 PM
Reality Check: Do any intermediate locks fire?
```

### Current System Behavior

**Our SchedulerService logic (as of 2/12/26):**
- Checks every 30 seconds for due schedules
- Fires unlock at start time
- Fires lock at end time
- **No priority system** - commands fire independently
- **No overlap detection** - allows overlapping schedules

**Potential Issues:**
1. End-of-schedule locks could override active unlocks (same as VIA)
2. Multiple schedules could send conflicting commands
3. No "keep unlocked while ANY schedule active" logic

### Solutions to Consider

**Option 1: Priority Field (Phase 2)**
- Add `Priority` column to `UnlockSchedules` table
- Higher priority schedules override lower priority locks
- Example: Manual unlocks (priority 10) > Card schedules (priority 5)

**Option 2: "Any Unlock Wins" Logic (Phase 1 fix)**
- Before sending LOCK, check if any other schedule is currently active
- Only lock if NO active schedules want the door unlocked
- Requires additional query in SchedulerService

**Option 3: Conflict Detection (Phase 1 UI)**
- Warn users when creating overlapping schedules
- Show visual timeline of conflicts
- Let users decide how to handle

**Option 4: Virtual "Merged Schedule" (Advanced)**
- Combine all active schedules into a single unlock window
- Example: Schedules at 8-6 and 5:30-7:30 merge to 8-7:30
- Only send lock when ALL schedules end

### Billy's Directive

> "Just remember this as a pain point we are fixing and must test before production"

**Action Items:**
1. ✅ Document the problem (this file)
2. ⏳ Run Test 2 (Billy's scenario) with real door
3. ⏳ Observe what happens at the overlap end time
4. ⏳ Decide on solution (Option 1-4 above)
5. ⏳ Implement fix before expanding to critical doors
6. ⏳ Re-test with main entrance or critical doors

---

## Other Pre-Production Tests

### Security Tests
- [ ] Test authentication failure handling (wrong password)
- [ ] Test session timeout recovery (30-minute expiry)
- [ ] Test database connection failure
- [ ] Test MonitorCast API down/unreachable

### Reliability Tests
- [ ] Run scheduler for 24 hours straight (stability test)
- [ ] Test 10+ schedules on same door (stress test)
- [ ] Test all 58 doors (full deployment)
- [ ] Test during actual church event (real-world validation)

### Edge Cases
- [ ] Schedule with start=end (zero duration)
- [ ] Schedule deleted while active
- [ ] Multiple schedules for same door at exact same time
- [ ] Door removed from VIA database (orphaned schedule)

---

## Production Readiness Checklist

- [ ] Overlapping schedule priority issue resolved
- [ ] All 58 doors tested with Reader IDs
- [ ] 24-hour stability test passed
- [ ] Real event test completed successfully
- [ ] Billy approves for production use

**Status:** Phase 1 complete, Critical Test required before wider deployment
