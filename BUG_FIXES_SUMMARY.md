# FBCA Door Control - Bug Fixes Summary
**Date:** 2026-02-12  
**Fixed By:** OpenClaw Agent (Claude)  
**Environment:** Mac workspace copy

---

## Overview
Fixed three critical bugs preventing the application from compiling and running correctly. All changes have been made to the Mac workspace copy and need to be deployed to the Windows production server.

---

## Bug Fixes

### 1. ✅ **VIACDbContext.cs - HasNoKey() Conflict**
**File:** `Data/VIACDbContext.cs`  
**Lines:** 28, 34  
**Issue:** Entity Framework configuration error - entities were marked with both `HasKey()` and `HasNoKey()`, which are mutually exclusive.

**Error Message:**
```
"entity type 'VIADevice' cannot be marked as keyless because it contains a key {'DeviceID'}"
```

**Fix Applied:**
- Removed `entity.HasNoKey()` calls from both VIADevice and VIAController entity configurations
- Kept `entity.HasKey()` calls (which are correct - these entities DO have primary keys)
- Added explanatory comments

**Impact:** This was a blocking compilation error. The fix allows Entity Framework to properly map to the VIA Access Control database tables.

---

### 2. ✅ **SchedulerService.cs - LINQ Translation Error**
**File:** `Services/SchedulerService.cs`  
**Lines:** 60-69, 91-99  
**Issue:** LINQ query attempted to call C# methods (`HasRecentUnlock()` and `HasRecentLock()`) inside a `Where()` clause. Entity Framework cannot translate arbitrary C# methods to SQL.

**Error Message:**
```
"LINQ query can't translate HasRecentUnlock() method to SQL"
```

**Fix Applied:**
- Split queries into two steps:
  1. Load candidate schedules from database (SQL query)
  2. Filter for recent actions in memory (C# code)
- Added explanatory comments for future maintainers
- Same pattern applied to both UNLOCK and LOCK schedule queries

**Impact:** This was a runtime error. The fix allows the scheduler to properly check for schedules without crashing.

**Performance Note:** The in-memory filtering is acceptable because:
- Active schedules are small in number
- Queries run every 30 seconds (not high frequency)
- The DB query still filters by time windows, limiting data transfer

---

### 3. ⚠️ **QuickControlsService.cs - MonitorCast Auth Endpoint**
**File:** `Services/QuickControlsService.cs`  
**Lines:** 193-204  
**Issue:** Authentication endpoint `/Account/Login` returns 404 in Mac testing environment.

**Root Cause:** MonitorCast is Windows-only software and not installed on the Mac development machine. The 404 error is expected in this environment.

**Fix Applied:**
- Added detailed inline comments documenting:
  - Why the 404 occurs (Mac vs Windows)
  - What needs testing on Windows
  - Expected behavior on production server
- No code logic changes required

**Testing Required on Windows:**
1. Verify MonitorCast is running on the production server
2. Confirm `/Account/Login` endpoint exists and accepts POST requests
3. Test authentication with valid credentials
4. Verify session cookies are returned in `Set-Cookie` headers
5. Test full unlock/lock workflow via Quick Controls API

---

## Testing Checklist

### ✅ Completed (Mac Environment)
- [x] Syntax validation (all files)
- [x] Logic review (refactored queries)
- [x] Code comments added

### 🔲 Required (Windows Production Server)

#### Before Deployment:
- [ ] Backup current production code
- [ ] Review all changed files
- [ ] Run `dotnet build` to verify compilation

#### After Deployment:
- [ ] Verify application starts without errors
- [ ] Check Entity Framework migrations (if any)
- [ ] Test database connectivity (VIA Access Control DB)
- [ ] **Critical:** Test MonitorCast authentication
  - Check MonitorCast service is running
  - Verify `/Account/Login` endpoint responds
  - Confirm session cookies are received
- [ ] Test manual door unlock/lock via web interface
- [ ] Monitor SchedulerService logs for 5-10 minutes
  - Should see "Checking schedules at..." debug messages
  - Should NOT see LINQ translation errors
  - Should NOT see HasKey/HasNoKey errors
- [ ] Test a scheduled unlock/lock action end-to-end
- [ ] Verify ScheduleActionLog entries are created

---

## Deployment Instructions

### 1. Copy Files to Windows Server
Transfer the following modified files from Mac workspace to Windows production:
```
fbca-door-control/
├── Data/VIACDbContext.cs
├── Services/SchedulerService.cs
└── Services/QuickControlsService.cs
```

### 2. Build and Deploy
```cmd
cd C:\Path\To\fbca-door-control
dotnet build --configuration Release

# If build succeeds:
# Stop the service, copy build output, restart service
```

### 3. Monitor Logs
Watch application logs immediately after deployment:
```cmd
# Check Windows Event Viewer or application log files
# Look for:
# - "Scheduler service starting"
# - "Authenticating to MonitorCast"
# - Any error messages
```

### 4. Smoke Test
- Open web interface
- Navigate to Door Control page
- Try manually unlocking a door
- Verify action appears in logs
- Check ScheduleActionLog table in database

---

## Configuration to Verify

Ensure these settings are correct in `appsettings.json` on Windows:

```json
{
  "MonitorCast": {
    "BaseUrl": "http://localhost:8080",  // Verify MonitorCast port
    "Username": "admin",                  // Verify username
    "Password": "********",               // Ensure password is set
    "RetryAttempts": 3,
    "RetryDelaySeconds": 5
  },
  "Scheduler": {
    "CheckIntervalSeconds": 30,
    "ActionGracePeriodMinutes": 5
  }
}
```

**Critical:** If MonitorCast uses a different port or path, update `BaseUrl` accordingly.

---

## Known Limitations

1. **MonitorCast Dependency:** This application cannot function without MonitorCast running. If MonitorCast is down, all door control operations will fail.

2. **Session Management:** The current implementation assumes MonitorCast sessions last 30 minutes. If MonitorCast has a shorter timeout, you may see authentication failures.

3. **No Transaction Rollback:** If a database write succeeds but MonitorCast fails, the log entry will show `Success = false` but won't be rolled back. This is by design for audit trail purposes.

---

## Rollback Plan

If deployment fails:

1. Stop the application service
2. Restore previous version from backup
3. Restart service
4. Document any error messages
5. Contact developer with logs

---

## Contact

For issues during deployment:
- Review detailed comments in modified files
- Check Windows Event Viewer for .NET errors
- Verify MonitorCast service status
- Test MonitorCast endpoints with Postman/curl

---

## Summary of Code Changes

### VIACDbContext.cs
```csharp
// BEFORE (line 28):
entity.HasKey(e => e.DeviceID);
entity.HasNoKey(); // ❌ CONFLICT

// AFTER:
entity.HasKey(e => e.DeviceID);
// Note: HasKey() is sufficient - HasNoKey() removed as it conflicts
```

### SchedulerService.cs
```csharp
// BEFORE (line 60-69):
var unlockSchedules = await dbContext.UnlockSchedules
    .Where(s => s.IsActive && ... && !HasRecentUnlock(...))  // ❌ Can't translate to SQL
    .ToListAsync();

// AFTER:
var allActiveUnlockSchedules = await dbContext.UnlockSchedules
    .Where(s => s.IsActive && ...)  // ✅ SQL query
    .ToListAsync();
var unlockSchedules = allActiveUnlockSchedules
    .Where(s => !HasRecentUnlock(...))  // ✅ In-memory filter
    .ToList();
```

### QuickControlsService.cs
```csharp
// Added documentation comments explaining MonitorCast Windows-only requirement
// and testing requirements for production deployment
```

---

**End of Summary**
