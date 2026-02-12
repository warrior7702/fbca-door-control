# MonitorCast API Research Findings

**Date:** 2026-02-12  
**Server:** 10.5.5.31:8080  
**Version:** MonitorCast 4.2.1.8

## Key Discoveries

### 1. Login Endpoint
**Current code tries:** `POST /Account/Login` ❌ (returns 404)  
**Actual login page:** `GET /` (root)  
**Need to find:** What endpoint the login form POSTs to

### 2. Door Control Interface
**Door Management Page:** `/Dashboard/LockUnlockDoor`  
This is the QuickControls interface mentioned in our code.

### 3. Navigation Structure
```
/Dashboard/Dashboard         - Main dashboard
/Dashboard/LockUnlockDoor   - Door control (Quick Controls)
/Dashboard/CustomDashboard  - Custom views
/Hardware/*                  - Hardware management
/AccessLevel/Create          - Access level management
```

## Next Steps to Fix Authentication

### Option A: Find Login POST Endpoint
Need Billy to check browser DevTools Network tab when logging in to see:
- What URL the form POSTs to
- What parameters are sent (username, password, others?)
- What cookies/headers are returned

### Option B: View Page Source
Check the login page HTML source for the `<form action="...">` attribute

### Option C: Test Common Endpoints
Try these common ASP.NET MVC login endpoints:
- `POST /`
- `POST /Home/Login`
- `POST /Login`
- `POST /Dashboard/Login`

## Suspected Login Flow

Based on ASP.NET MVC patterns:
```
1. GET /                          → Login page HTML
2. POST / or /Home/Login          → Submit credentials
3. Receive ASP.NET session cookie → Authentication token
4. POST /Dashboard/LockUnlockDoor → Execute door commands
```

## Code Changes Needed

Once we know the correct login endpoint, update:
**File:** `Services/QuickControlsService.cs`
**Line:** Authentication POST request URL

**Current:**
```csharp
var response = await _httpClient.PostAsync(
    "/Account/Login",  // ← Wrong endpoint
    new FormUrlEncodedContent(loginData)
);
```

**Fix:** Replace `/Account/Login` with correct endpoint

## MonitorCast Details Observed
- Uses form-based authentication
- Session-based (cookies)
- ASP.NET MVC architecture
- License limitation warnings (41/35 readers)
- Real-time event monitoring on dashboard
