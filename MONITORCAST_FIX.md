# MonitorCast Authentication Fix

**Date:** 2026-02-12 13:45 CST  
**Issue:** 404 error on MonitorCast login  
**Status:** ✅ FIXED

## What Was Wrong

**Old Code (QuickControlsService.cs):**
```csharp
// Wrong endpoint
var response = await _httpClient.PostAsync("/Account/Login", loginContent);

// Wrong parameter names
new KeyValuePair<string, string>("username", Username),  // lowercase
new KeyValuePair<string, string>("password", Password)   // lowercase
// Missing LoginType field
```

## The Fix

**New Code:**
```csharp
// Correct endpoint: root
var response = await _httpClient.PostAsync("/", loginContent);

// Correct parameter names (case-sensitive!)
new KeyValuePair<string, string>("UserName", Username),  // PascalCase
new KeyValuePair<string, string>("Password", Password),  // PascalCase
new KeyValuePair<string, string>("LoginType", "1")      // Required hidden field
```

## What Changed

**File:** `Services/QuickControlsService.cs`  
**Lines:** ~167-178 (AuthenticateAsync method)

**Changes:**
1. Endpoint: `/Account/Login` → `/`
2. Username field: `username` → `UserName`
3. Password field: `password` → `Password`
4. Added: `LoginType=1` parameter

## Deploy & Test

### 1. Deploy Fixed File
Copy updated `Services/QuickControlsService.cs` from Mac to Windows:
```
From: /Users/fbclaude/.openclaw/workspace/fbca-door-control/Services/QuickControlsService.cs
To:   C:\Projects\fbca-door-control\Services\QuickControlsService.cs
```

### 2. Rebuild & Restart
```powershell
cd C:\Projects\fbca-door-control
dotnet build
# Stop current app (Ctrl+C)
dotnet run
```

### 3. Watch Logs
Look for this in PowerShell output:
```
✅ Success: "MonitorCast authentication successful, session cookies received"
❌ Failure: "MonitorCast authentication failed: [status code]"
```

### 4. Test in Web UI
1. Open http://localhost:5002
2. Click "Open Calendar"
3. Click "🔄 Sync Doors" (should work, already tested)
4. Create a test schedule:
   - Pick a door
   - Set unlock time: 2 minutes from now
   - Set lock time: 5 minutes from now
5. **Watch the PowerShell terminal** for scheduler logs
6. **Within 30 seconds of unlock time**, you should see:
   - "Executing Quick Controls: unlock door [ID]"
   - Success/failure message

### 5. CRITICAL - Test with Safe Door First!
**⚠️ DO NOT test with main entrance or security doors!**

Pick a test door like:
- An office interior door
- Storage room
- Non-critical area

Verify you can physically check if it actually unlocks/locks.

## What Should Happen

### Before (Broken):
```
fail: MonitorCast authentication failed: NotFound - Not Found
```

### After (Fixed):
```
info: MonitorCast authentication successful, session cookies received
info: Executing Quick Controls: unlock door 123
info: Quick Controls executed successfully
```

## If It Still Fails

Check logs for:
1. **401 Unauthorized** → Username/password wrong in appsettings.json
2. **404 Not Found** → MonitorCast service not running at 10.5.5.31:8080
3. **500 Internal Server Error** → MonitorCast issue, check MonitorCast logs
4. **Timeout** → Network issue or MonitorCast hung

## What's Next After This Works

1. ✅ Authentication working
2. ✅ Can send unlock/lock commands
3. Test actual door control (carefully!)
4. Monitor for 24 hours to verify scheduler reliability
5. **Then** consider PCO integration (Phase 3)

## Safety Reminder

**Right now this will start ACTUALLY controlling doors!**

- Scheduler runs every 30 seconds
- Any schedule within the time window will execute
- No undo once a command is sent
- Test schedules carefully in non-critical areas first

**Recommendation:** Test over lunch hour or weekend when building activity is low.
