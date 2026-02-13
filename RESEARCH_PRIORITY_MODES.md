# Research: Reader Mode Priority & Override Mechanisms

**Date:** 2026-02-12 23:23 CST  
**Goal:** Find if MonitorCast/VIA supports priority levels or override masks to prevent Card/Pin schedules from killing Unlock schedules

---

## Problem Statement

**Current Issue:**
- MonitorCast Card/Pin schedules (majority of schedules) end with LOCK command
- LOCK commands override active Unlock schedules from our system
- No priority mechanism to say "Unlock beats Card/Pin ending"

**Confirmed Tonight (11:20 PM test):**
- MonitorCast Card/Pin: 10:40-11:20 PM
- Our Unlock: 11:14-11:30 PM
- Result: Door locked at 11:20 PM (Card/Pin ending killed our unlock)

---

## Standard Access Control Reader Modes

Based on industry research (Honeywell, LenelS2, Elements):

### Common Reader Modes:
1. **Locked** - No access, door stays locked
2. **Unlocked** - Free access, door stays unlocked
3. **Card Only** - Swipe card to unlock
4. **Card and PIN** - Both required
5. **Card or PIN** - Either works
6. **PIN Only** - PIN code required
7. **First Card Unlock** - First authorized card unlocks door for schedule duration

### Key Finding:
> "The door will remain unlocked until the next transition out of the schedule, **or the reader mode is manually overridden**."
> Source: Elements Secure Access Control

**This means:**
- Reader modes CAN be overridden
- Manual overrides persist until next schedule transition
- BUT: Schedule transitions (endings) DO override manual changes

---

## MonitorCast Reader Modes Observed

From our logs:
```
Reader Mode Changed (CardOrPin -> Unlock)  // Our unlock command
Reader Mode Changed (Unlock -> CardOrPin)  // Schedule ending
```

**MonitorCast uses:**
- `CardOrPin` (Card/Pin access)
- `Unlock` (fully unlocked)
- Possibly others (Locked, CardOnly, etc.)

**When Card/Pin schedule ends:**
- MonitorCast sends "Reader Mode Changed (Unlock -> CardOrPin)" 
- Or "Reader Mode Changed (Unlock -> Locked)" depending on off-schedule mode

---

## Questions for Billy / Database Research

### 1. VIA Database Schedule Tables
**Need to query VIA database for:**
```sql
-- Find schedule-related tables
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME LIKE '%Schedule%' 
   OR TABLE_NAME LIKE '%Access%'
   OR TABLE_NAME LIKE '%Reader%'
   OR TABLE_NAME LIKE '%Mode%';

-- Look for priority/mask fields in schedule tables
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'HW_TimeSchedules' -- or similar
  AND (COLUMN_NAME LIKE '%Priority%' 
   OR COLUMN_NAME LIKE '%Mask%'
   OR COLUMN_NAME LIKE '%Override%'
   OR COLUMN_NAME LIKE '%Level%');
```

### 2. MonitorCast API Parameters
**When we send unlock command:**
```
POST /Dashboard/LockUnlockDoor
Content-Type: application/x-www-form-urlencoded

btnUnlockDoor=true&s=&s=&ReadersSelectedList=122
```

**Possible parameters to test:**
- `Priority=10` (higher priority)
- `Duration=600` (seconds to stay unlocked)
- `Override=true` (ignore other schedules)
- `IgnoreMask=true` (ignore schedule masks)
- `Level=Emergency` (access level)

### 3. MonitorCast Manual Override Feature
**Billy's setup:**
- Does MonitorCast UI have a "Manual Override" button?
- If yes, what API call does it make?
- Does manual override persist through schedule transitions?

---

## Potential Solutions

### Option A: API Parameter Discovery (BEST IF IT EXISTS)
**Test MonitorCast unlock API with additional parameters:**
1. Try `Priority` parameter (e.g., Priority=10)
2. Try `Duration` parameter (persist for X seconds)
3. Try `Override` flag (ignore schedule endings)
4. Capture browser DevTools when using MonitorCast manual override

**If we find a priority/override parameter:**
- Our unlocks could be "high priority"
- Card/Pin schedule endings would be "low priority"
- High priority commands persist through low priority transitions

### Option B: Database Schedule Masking (IF SAFE)
**If VIA database has schedule mask/priority fields:**
- Mark MonitorCast native schedules with "can be overridden" flag
- Our schedules marked as "cannot be overridden"
- **Risk:** Writing to VIA database (Billy's constraint)

### Option C: Continuous Re-unlock (LAST RESORT)
**Monitor and fight back:**
```
11:14 PM: Our unlock schedule starts
11:20 PM: MonitorCast Card/Pin ends, sends LOCK
11:20 PM + 30s: Our scheduler detects door locked, sends UNLOCK again
Every 30s: Re-check and re-unlock if needed until 11:30 PM
```

**Pros:** Works with zero VIA/MonitorCast changes  
**Cons:** Creates endless logs, annoying "fight" between systems

### Option D: Migrate All Schedules (CLEANEST)
**Move all Card/Pin schedules from MonitorCast to our system:**
1. Export MonitorCast schedules
2. Create equivalent schedules in our database
3. Add "Reader Mode" field to our UnlockSchedules table
4. Support both Card/Pin and Unlock modes
5. Disable MonitorCast native schedules
6. Only our system sends reader mode commands

**Pros:** Complete control, no conflicts  
**Cons:** Big migration effort, requires UI for Card/Pin schedules

---

## Next Steps (Priority Order)

### 1. Database Research (FIRST - Billy runs SQL queries)
```sql
-- Billy to run on Windows server:
USE VIAC;  -- or whatever the VIA database is called

-- Find all schedule-related tables
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Once we find schedule table, check for priority fields
SELECT * FROM [schedule_table_name] WHERE 1=0;  -- just to see columns
```

### 2. API Parameter Testing (QUICK TESTS)
**Billy can test in MonitorCast UI:**
- Manually override a door (like Emergency Unlock button)
- Check browser DevTools Network tab
- See what parameters the manual override sends

**Then we test adding those parameters to our API calls**

### 3. MonitorCast Documentation (IF AVAILABLE)
- Does Billy have access to MonitorCast admin guide?
- VIA system manual?
- Any vendor documentation about schedule priority?

### 4. Vendor Support (IF NEEDED)
- Contact VIA/Vigilant support
- Ask: "How do we implement schedule priority for overlapping schedules?"
- Ask: "Can API unlocks override schedule transitions?"

---

## Research Status

- [x] Confirmed problem exists (live test at 11:20 PM)
- [x] Identified root cause (Card/Pin endings send LOCK)
- [x] Researched industry standard reader modes
- [ ] **TODO:** Query VIA database for schedule tables and priority fields
- [ ] **TODO:** Test MonitorCast API with priority parameters
- [ ] **TODO:** Capture browser network traffic from manual override
- [ ] **TODO:** Check for MonitorCast documentation

**Billy to provide:**
1. SQL query results from VIA database
2. Browser DevTools capture of manual override (if feature exists)
3. Access to any MonitorCast/VIA documentation

---

_This research doc will be updated as we discover more about the system._
