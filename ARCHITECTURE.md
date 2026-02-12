# FBCA Door Control System - Architecture Document

**Version:** 1.0  
**Date:** February 11, 2026  
**Architect:** Cornerstone (AI Agent 1)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  FullCalendar Web UI (Port 5001/wwwroot)                   │   │
│  │  - calendar.html (main page)                                │   │
│  │  - calendar.js (event handling)                            │   │
│  │  - calendar.css (styling)                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              │ HTTP                                 │
└──────────────────────────────┼──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                              │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  ASP.NET Core Web API (Program.cs)                         │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │  Controllers/                                        │ │   │
│  │  │  - SchedulesController.cs                            │ │   │
│  │  │  - DoorsController.cs                                │ │   │
│  │  │  - HealthController.cs                               │ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │  Services/                                           │ │   │
│  │  │  - QuickControlsService.cs                           │ │   │
│  │  │  - DoorSyncService.cs                                │ │   │
│  │  │  - SchedulerService.cs (Background)                  │ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              │ EF Core                              │
└──────────────────────────────┼──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA ACCESS LAYER                             │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Data/                                                      │   │
│  │  - DoorControlDbContext.cs                                 │   │
│  │  - VIACDbContext.cs (read-only)                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Models/                                                    │   │
│  │  - Door.cs                                                  │   │
│  │  - UnlockSchedule.cs                                        │   │
│  │  - ScheduleActionLog.cs                                     │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ FBCADoorControl│   │ VIAC (VIA DB)    │   │ MonitorCast API  │
│ SQL Server DB  │   │ (Read-Only)      │   │ Port 8080        │
│                │   │                  │   │ Quick Controls   │
└───────────────┘   └──────────────────┘   └──────────────────┘
```

---

## Folder Structure

```
fbca-door-control/
│
├── Program.cs                          # Application entry point
├── appsettings.json                    # Configuration
├── appsettings.Development.json        # Dev config
│
├── Controllers/                        # API Controllers
│   ├── SchedulesController.cs          # Schedule CRUD endpoints
│   ├── DoorsController.cs              # Door management endpoints
│   └── HealthController.cs             # Health check endpoint
│
├── Services/                           # Business logic services
│   ├── QuickControlsService.cs         # MonitorCast Quick Controls integration
│   ├── DoorSyncService.cs              # VIA door sync logic
│   ├── SchedulerService.cs             # Background scheduler (IHostedService)
│   └── ScheduleExecutorService.cs      # Execute unlock/lock actions
│
├── Data/                               # Database contexts
│   ├── DoorControlDbContext.cs         # Our database context
│   ├── VIACDbContext.cs                # VIA database context (read-only)
│   └── Migrations/                     # EF Core migrations
│       └── (auto-generated)
│
├── Models/                             # Data models
│   ├── Door.cs                         # Door entity
│   ├── UnlockSchedule.cs               # Schedule entity
│   ├── ScheduleActionLog.cs            # Audit log entity
│   └── DTOs/                           # Data Transfer Objects
│       ├── ScheduleDto.cs              # Schedule API contract
│       ├── DoorDto.cs                  # Door API contract
│       └── ActionLogDto.cs             # Action log API contract
│
├── wwwroot/                            # Static web files
│   ├── index.html                      # Landing page (redirects to calendar)
│   ├── calendar.html                   # Main calendar UI
│   ├── css/
│   │   └── calendar.css                # Custom styles
│   └── js/
│       └── calendar.js                 # FullCalendar logic
│
├── Middleware/                         # Custom middleware
│   ├── ErrorHandlingMiddleware.cs     # Global error handler
│   └── RequestLoggingMiddleware.cs    # Request/response logging
│
├── Utilities/                          # Helper classes
│   ├── MonitorCastAuthHelper.cs        # Session management
│   └── ScheduleHelper.cs               # Schedule calculation logic
│
├── Tests/                              # Unit tests (optional for Phase 1)
│   ├── Controllers.Tests/
│   ├── Services.Tests/
│   └── Integration.Tests/
│
└── README.md                           # Project documentation
```

---

## Database Schema

### FBCADoorControl Database

#### Table: Doors
```sql
CREATE TABLE Doors (
    DoorID INT IDENTITY(1,1) PRIMARY KEY,
    VIADeviceID INT NOT NULL,           -- Links to VIA HW_Devices.DeviceID
    DoorName NVARCHAR(255) NOT NULL,    -- e.g., "Wade Building - Main Entrance"
    ControllerID INT NULL,              -- VIA controller ID (1-6)
    ControllerName NVARCHAR(255) NULL,  -- e.g., "Controller 2: Wade Building"
    ControllerGroupID INT NULL,         -- VIA controller group
    IsActive BIT NOT NULL DEFAULT 1,    -- Can this door be scheduled?
    LastSyncTime DATETIME NULL,         -- Last sync from VIA database
    CONSTRAINT UQ_VIADeviceID UNIQUE (VIADeviceID)
);

CREATE INDEX IX_Doors_IsActive ON Doors(IsActive);
```

#### Table: UnlockSchedules
```sql
CREATE TABLE UnlockSchedules (
    ScheduleID INT IDENTITY(1,1) PRIMARY KEY,
    DoorID INT NOT NULL,                -- Which door(s) this applies to
    ScheduleName NVARCHAR(255) NULL,    -- Optional user-friendly name
    StartTime DATETIME NOT NULL,        -- When to unlock
    EndTime DATETIME NOT NULL,          -- When to lock back
    RecurrencePattern NVARCHAR(50) NULL,-- NONE, DAILY, WEEKLY, MONTHLY (Phase 2)
    RecurrenceEndDate DATETIME NULL,    -- When recurrence stops (Phase 2)
    Source NVARCHAR(50) NOT NULL DEFAULT 'Manual', -- Manual, PCO, System
    IsActive BIT NOT NULL DEFAULT 1,    -- Is schedule enabled?
    CreatedBy NVARCHAR(255) NULL,       -- Who created it (Phase 3)
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_UnlockSchedules_Doors FOREIGN KEY (DoorID) REFERENCES Doors(DoorID) ON DELETE CASCADE,
    CONSTRAINT CHK_EndTime CHECK (EndTime > StartTime)
);

CREATE INDEX IX_UnlockSchedules_StartTime ON UnlockSchedules(StartTime);
CREATE INDEX IX_UnlockSchedules_IsActive ON UnlockSchedules(IsActive);
```

#### Table: ScheduleActionLog
```sql
CREATE TABLE ScheduleActionLog (
    ActionID INT IDENTITY(1,1) PRIMARY KEY,
    ScheduleID INT NULL,                -- Which schedule triggered this (nullable for manual)
    DoorID INT NOT NULL,                -- Which door was affected
    ActionType NVARCHAR(20) NOT NULL,   -- UNLOCK, LOCK
    ActionTime DATETIME NOT NULL DEFAULT GETDATE(), -- When it happened
    Success BIT NOT NULL,               -- Did it work?
    ErrorMessage NVARCHAR(MAX) NULL,    -- If failed, why?
    TriggeredBy NVARCHAR(50) NOT NULL,  -- Schedule, Manual, System
    VIAResponseCode INT NULL,           -- HTTP status from MonitorCast
    VIAResponseBody NVARCHAR(MAX) NULL, -- Response for debugging
    CONSTRAINT FK_ActionLog_Schedules FOREIGN KEY (ScheduleID) REFERENCES UnlockSchedules(ScheduleID),
    CONSTRAINT FK_ActionLog_Doors FOREIGN KEY (DoorID) REFERENCES Doors(DoorID)
);

CREATE INDEX IX_ActionLog_ActionTime ON ScheduleActionLog(ActionTime DESC);
CREATE INDEX IX_ActionLog_DoorID ON ScheduleActionLog(DoorID);
```

---

## API Endpoint Details

### Schedules API

#### GET /api/schedules
**Description:** List all unlock schedules with optional filtering

**Query Parameters:**
- `doorId` (int, optional) - Filter by door
- `startDate` (DateTime, optional) - Filter by date range
- `endDate` (DateTime, optional)
- `isActive` (bool, optional) - Filter by active status
- `source` (string, optional) - Filter by source (Manual/PCO)

**Response:**
```json
{
  "schedules": [
    {
      "scheduleId": 1,
      "doorId": 5,
      "doorName": "Wade Building - Main Entrance",
      "scheduleName": "Sunday Service",
      "startTime": "2026-02-16T08:00:00Z",
      "endTime": "2026-02-16T13:00:00Z",
      "recurrencePattern": "WEEKLY",
      "recurrenceEndDate": null,
      "source": "Manual",
      "isActive": true,
      "createdAt": "2026-02-11T20:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST /api/schedules
**Description:** Create a new unlock schedule

**Request Body:**
```json
{
  "doorId": 5,
  "scheduleName": "Wednesday Bible Study",
  "startTime": "2026-02-12T18:00:00Z",
  "endTime": "2026-02-12T21:00:00Z",
  "recurrencePattern": "WEEKLY",
  "recurrenceEndDate": null,
  "source": "Manual"
}
```

**Response:** 201 Created
```json
{
  "scheduleId": 2,
  "message": "Schedule created successfully"
}
```

**Validation Rules:**
- `endTime` must be after `startTime`
- `doorId` must exist in Doors table
- `startTime` must be in the future (warn if in past)
- `recurrencePattern` must be valid enum value

#### DELETE /api/schedules/{id}
**Description:** Delete a schedule

**Response:** 204 No Content

---

### Doors API

#### GET /api/doors
**Description:** List all doors

**Query Parameters:**
- `isActive` (bool, optional) - Filter by active status
- `controllerId` (int, optional) - Filter by controller

**Response:**
```json
{
  "doors": [
    {
      "doorId": 5,
      "viaDeviceId": 42,
      "doorName": "Wade Building - Main Entrance",
      "controllerName": "Controller 2: Wade Building",
      "isActive": true,
      "lastSyncTime": "2026-02-11T19:00:00Z"
    }
  ],
  "total": 58
}
```

#### POST /api/sync-doors
**Description:** Sync door list from VIA database

**Response:**
```json
{
  "message": "Door sync completed",
  "doorsAdded": 5,
  "doorsUpdated": 53,
  "doorsDeactivated": 0,
  "syncTime": "2026-02-11T20:30:00Z"
}
```

**Logic:**
1. Query VIA `HW_Devices` table for all doors
2. For each door:
   - If exists in our Doors table → update name/controller info
   - If new → insert new row
   - If missing from VIA → mark `IsActive = 0`
3. Update `LastSyncTime` for all synced doors

#### POST /api/test-quick-controls/{id}
**Description:** Test immediate unlock/lock of a door

**Request Body:**
```json
{
  "action": "unlock"  // or "lock"
}
```

**Response:**
```json
{
  "success": true,
  "doorName": "Wade Building - Main Entrance",
  "action": "unlock",
  "timestamp": "2026-02-11T20:35:00Z",
  "viaResponseCode": 200
}
```

---

### Health API

#### GET /api/health
**Description:** System health check

**Response:**
```json
{
  "status": "Healthy",
  "timestamp": "2026-02-11T20:40:00Z",
  "checks": {
    "database": "Healthy",
    "viaDatabase": "Healthy",
    "monitorCast": "Healthy",
    "scheduler": "Running"
  },
  "uptime": "PT2H15M30S",
  "version": "1.0.0"
}
```

**Status Values:**
- `Healthy` - All systems operational
- `Degraded` - Some non-critical issues
- `Unhealthy` - Critical systems down

---

## Component Interfaces

### QuickControlsService

**Purpose:** Manage authentication and API calls to MonitorCast Quick Controls

**Interface:**
```csharp
public interface IQuickControlsService
{
    Task<bool> UnlockDoorAsync(int viaDeviceId);
    Task<bool> LockDoorAsync(int viaDeviceId);
    Task<bool> AuthenticateAsync();
    Task<bool> IsAuthenticatedAsync();
    Task<QuickControlsResponse> ExecuteActionAsync(int viaDeviceId, string action);
}
```

**Key Methods:**
- `AuthenticateAsync()` - Login to MonitorCast, store session cookies
- `UnlockDoorAsync(deviceId)` - Send unlock command via Quick Controls API
- `LockDoorAsync(deviceId)` - Send lock command
- `IsAuthenticatedAsync()` - Check if session is still valid
- `ExecuteActionAsync()` - Generic action executor (unlock/lock)

**Implementation Notes:**
- Use `HttpClient` with cookie container for session persistence
- Retry logic for network failures (3 retries with exponential backoff)
- Auto re-authenticate on 401 Unauthorized
- Log all requests/responses for debugging

---

### DoorSyncService

**Purpose:** Synchronize door list from VIA database to our database

**Interface:**
```csharp
public interface IDoorSyncService
{
    Task<DoorSyncResult> SyncDoorsAsync();
    Task<List<Door>> GetDoorsFromVIAAsync();
}
```

**Key Methods:**
- `SyncDoorsAsync()` - Full sync process (add/update/deactivate)
- `GetDoorsFromVIAAsync()` - Query VIA database for current door list

**Implementation Notes:**
- Read-only access to VIA database (never write)
- Query joins: `HW_Devices` ← `HW_Controllers`
- Handle null controller names gracefully
- Transaction: sync all or none

---

### SchedulerService (Background Service)

**Purpose:** Background service that checks for due schedules and executes unlock/lock actions

**Interface:**
```csharp
public class SchedulerService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken);
    private async Task CheckAndExecuteSchedulesAsync();
    private async Task ExecuteScheduleActionAsync(UnlockSchedule schedule, string action);
}
```

**Key Methods:**
- `ExecuteAsync()` - Main loop (runs every 30 seconds)
- `CheckAndExecuteSchedulesAsync()` - Query due schedules, execute actions
- `ExecuteScheduleActionAsync()` - Execute specific unlock/lock

**Implementation Notes:**
- Run every 30 seconds (configurable)
- Query schedules where `StartTime <= NOW <= EndTime + 5 minutes` (grace period)
- Check action log: don't re-unlock already unlocked doors (idempotent)
- Log all actions to `ScheduleActionLog`
- Handle exceptions: log error, continue processing other schedules

**Schedule Execution Logic:**
```csharp
// Pseudo-code
while (true)
{
    var now = DateTime.Now;
    
    // Find schedules needing unlock (start time passed, not yet unlocked)
    var unlockSchedules = db.UnlockSchedules
        .Where(s => s.IsActive 
                 && s.StartTime <= now 
                 && s.EndTime > now
                 && !HasRecentUnlock(s.ScheduleID, now))
        .ToList();
    
    foreach (var schedule in unlockSchedules)
    {
        await UnlockDoorAsync(schedule.DoorID);
        LogAction(schedule.ScheduleID, schedule.DoorID, "UNLOCK", success);
    }
    
    // Find schedules needing lock (end time passed, not yet locked)
    var lockSchedules = db.UnlockSchedules
        .Where(s => s.IsActive 
                 && s.EndTime <= now
                 && !HasRecentLock(s.ScheduleID, now))
        .ToList();
    
    foreach (var schedule in lockSchedules)
    {
        await LockDoorAsync(schedule.DoorID);
        LogAction(schedule.ScheduleID, schedule.DoorID, "LOCK", success);
    }
    
    await Task.Delay(TimeSpan.FromSeconds(30));
}
```

---

## Configuration

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "FBCADoorControl": "Server=FBCA-SQL;Database=FBCADoorControl;Trusted_Connection=True;TrustServerCertificate=True;",
    "VIAC": "Server=FBCA-SQL;Database=VIAC;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "MonitorCast": {
    "BaseUrl": "http://localhost:8080",
    "Username": "admin",
    "Password": "[REDACTED]",
    "SessionTimeoutMinutes": 30
  },
  "Scheduler": {
    "CheckIntervalSeconds": 30,
    "ActionGracePeriodMinutes": 5,
    "RetryAttempts": 3,
    "RetryDelaySeconds": 5
  },
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://localhost:5002"
      }
    }
  }
}
```

---

## Error Handling Strategy

### Global Error Handler (Middleware)

**Status Codes:**
- `200 OK` - Success
- `201 Created` - Resource created
- `204 No Content` - Success with no response body
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Authentication required (future)
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Unexpected error

**Error Response Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "End time must be after start time",
    "details": {
      "field": "endTime",
      "value": "2026-02-12T10:00:00Z"
    }
  },
  "timestamp": "2026-02-11T20:45:00Z",
  "path": "/api/schedules"
}
```

### Logging Strategy

**Log Levels:**
- `Trace` - Scheduler loop iterations (verbose)
- `Debug` - HTTP requests/responses, SQL queries
- `Information` - Schedule actions, door sync, health checks
- `Warning` - Retry attempts, degraded state
- `Error` - API failures, database errors
- `Critical` - System-wide failures

**Log Destinations:**
- Console (development)
- File (production) - `/logs/fbca-door-control.log`
- Database (future) - Consider structured logging table

---

## Deployment Architecture

### Hosting Environment

**Server:** Windows Server 2019+ (FBCA internal network)

**Prerequisites:**
- .NET 8 Runtime
- IIS 10+ (or run as standalone Kestrel service)
- SQL Server 2019+ (existing FBCA instance)
- MonitorCast running on localhost:8080
- Network access to VIA database

**Service Configuration:**
```
Application Pool: FBCADoorControl
.NET CLR Version: No Managed Code (.NET 8)
Pipeline Mode: Integrated
Identity: ApplicationPoolIdentity (or domain service account)
Start Mode: AlwaysRunning
Idle Timeout: 0 (keep alive)
```

### Deployment Steps

1. **Publish Application:**
   ```bash
   dotnet publish -c Release -o ./publish
   ```

2. **Create Database:**
   ```sql
   CREATE DATABASE FBCADoorControl;
   ```

3. **Run Migrations:**
   ```bash
   dotnet ef database update --connection "[connection string]"
   ```

4. **Deploy Files:**
   - Copy `/publish` to `C:\inetpub\wwwroot\fbca-door-control\`
   - Set permissions: IIS_IUSRS read/execute

5. **Configure IIS:**
   - Create application in IIS Manager
   - Set port 5001 binding
   - Install URL Rewrite module (for SPA routing)

6. **Start Service:**
   - Start application pool
   - Verify health endpoint: `http://localhost:5002/api/health`

---

## Testing Strategy

### Manual Testing (Phase 1)

1. **Door Sync:**
   - POST `/api/sync-doors`
   - Verify 58 doors loaded
   - Check door names match VIA

2. **Schedule Creation:**
   - POST `/api/schedules` with valid data
   - Verify schedule appears in GET `/api/schedules`
   - Check database: `SELECT * FROM UnlockSchedules`

3. **Quick Controls Test:**
   - POST `/api/test-quick-controls/{doorId}` action=unlock
   - Physically verify door unlocks
   - Check `ScheduleActionLog` for success=true

4. **Scheduler Service:**
   - Create schedule for 2 minutes in future
   - Wait for start time
   - Verify door unlocks automatically
   - Check action log

5. **UI Testing:**
   - Open calendar.html
   - Add schedule via UI
   - Verify schedule appears on calendar
   - Delete schedule, verify removed

### Automated Testing (Phase 2)

- Unit tests for services (QuickControlsService, DoorSyncService)
- Integration tests for API controllers
- End-to-end test: Create schedule → verify door action

---

## Phase 3 Preview: PCO Integration

**Architecture Addition:**

```
┌────────────────────────────────────────┐
│  PCO Sync Service (Background)         │
│  - Poll PCO API every 5 minutes        │
│  - Detect new/changed/cancelled events │
│  - Map PCO location → Doors            │
│  - Auto-create UnlockSchedules         │
└────────────────────────────────────────┘
          │
          ▼ POST /api/schedules (internal)
    (existing system)
```

**New Components:**
- `PCOSyncService.cs` (IHostedService)
- `PCOApiClient.cs` (HTTP client for PCO API)
- `LocationMappingService.cs` (Location → Door mapping)
- `PCOLocationMappings` table (configuration)

**Deferred to Phase 3 - Not Blocking Phase 1-2**

---

## Security Considerations

### Secrets Management
- ✅ MonitorCast credentials in `appsettings.json` (file system ACLs)
- ✅ Database connection strings use Windows Authentication (no passwords)
- ⚠️ Consider Azure Key Vault for Phase 3 (if moving to cloud)

### Network Security
- ✅ Internal network only (no public internet exposure)
- ✅ MonitorCast on localhost (no network traversal)
- ✅ SQL Server with Windows Authentication (no SQL auth)

### Data Security
- ✅ Audit log immutable (no deletes)
- ✅ Input validation on all API endpoints
- ✅ Parameterized SQL queries (EF Core protects against SQL injection)

### Future Enhancements (Phase 3)
- Role-based access control (RBAC)
- Active Directory integration
- API authentication (JWT tokens)
- HTTPS enforcement

---

## Performance Optimization

### Database Indexes
- `IX_Doors_IsActive` - Fast filtering of active doors
- `IX_UnlockSchedules_StartTime` - Scheduler queries
- `IX_UnlockSchedules_IsActive` - Filter active schedules
- `IX_ActionLog_ActionTime` - Audit log queries (descending)
- `IX_ActionLog_DoorID` - Door-specific history

### Caching Strategy
- ✅ Door list cached in memory (sync every 1 hour)
- ✅ MonitorCast session cookies cached (30 min expiry)
- ❌ No schedule caching (real-time accuracy required)

### Query Optimization
- Use `.AsNoTracking()` for read-only queries
- Limit schedule lookups: `WHERE StartTime <= NOW + 1 hour`
- Batch door unlock commands (if possible)

---

## Monitoring & Observability

### Health Checks
- Database connectivity (ping FBCADoorControl)
- VIA database connectivity (ping VIAC)
- MonitorCast availability (HTTP GET /Account/Login)
- Scheduler service running (heartbeat check)

### Metrics to Track (Future)
- Schedules executed per day
- Success rate of door actions
- Average response time from MonitorCast API
- Door action errors (by door, by controller)

### Alerts (Future)
- Email/SMS when scheduler service stops
- Alert when MonitorCast unreachable >5 minutes
- Alert when database connection lost

---

## Assumptions & Dependencies

### Assumptions
1. MonitorCast Quick Controls API is stable
2. VIA database schema won't change
3. Session cookies remain valid for 30 minutes
4. Controllers respond to unlock/lock within 5 seconds
5. Network latency <100ms

### External Dependencies
- MonitorCast ASP.NET MVC application
- VIA Access Control database
- FBCA SQL Server instance
- Windows Server hosting environment

### Breaking Changes Risk
- ⚠️ MonitorCast API changes (mitigation: version check on startup)
- ⚠️ VIA database schema changes (mitigation: read-only, low risk)
- ⚠️ Controller firmware updates (mitigation: test in dev first)

---

## Appendix: VIA Database Schema (Read-Only)

### HW_Controllers
```sql
SELECT ControllerID, ControllerName, ControllerGroupID
FROM HW_Controllers
WHERE IsActive = 1;
```

### HW_Devices (Doors)
```sql
SELECT 
    DeviceID,           -- Our VIADeviceID
    DeviceName,         -- Our DoorName
    ControllerID,       -- Links to HW_Controllers
    IsActive
FROM HW_Devices
WHERE DeviceType = 'Door';  -- Filter to doors only
```

---

_Generated by Agent 1 (Architect) - February 11, 2026 8:45 PM CST_
