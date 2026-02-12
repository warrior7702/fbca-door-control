# FBCA Door Control System - Project Specification

**Project Owner:** Billy Nelms  
**Start Date:** February 11, 2026  
**Target Completion:** Phase 1-2 by end of February 2026  
**Repository:** `~/.openclaw/workspace/fbca-door-control/`

---

## Executive Summary

Replace First Baptist Church Arlington's terrible MonitorCast door scheduling UI with a modern web application that automatically unlocks/locks 58 doors based on schedules. Future integration with Planning Center Online will eliminate manual schedule creation entirely.

---

## Problem Statement

### Current Pain Points
1. **Terrible UI** - MonitorCast's scheduling interface is confusing and time-consuming
2. **Manual Process** - Staff manually creates door unlock schedules for every event
3. **No Integration** - Planning Center Online (PCO) has all event data but doesn't connect to door system
4. **Error-Prone** - Easy to forget schedules, set wrong times, configure wrong doors
5. **Complex System** - Multiple overlapping schedules with no clear priority mechanism

### Business Impact
- Staff time wasted on manual door management
- Security risk from forgotten unlocks (doors left unsecured)
- Poor user experience for church staff
- Events delayed or disrupted due to locked doors

---

## Vision

**"When someone schedules an event in Planning Center Online, the doors automatically unlock and lock at the right times, without anyone touching MonitorCast."**

### Success Criteria

| Criteria | Status | Priority |
|----------|--------|----------|
| 1. Replace MonitorCast UI with better interface | Phase 1 | P0 |
| 2. Automatically unlock/lock doors based on schedules | Phase 1 | P0 |
| 3. Complete audit trail of all door actions | Phase 2 | P0 |
| 4. Sync with Planning Center Online events | Phase 3 | P1 |
| 5. More reliable than current system | Phase 1-2 | P0 |

**Phases:**
- **Phase 1:** Core door control system (UI + scheduling)
- **Phase 2:** Automation + audit logging
- **Phase 3:** Planning Center Online integration (future)

---

## System Context

### Existing Infrastructure (DO NOT MODIFY)

**VIA Access Control System (VIAC Database):**
- 58+ physical doors across campus
- 6 hardware controllers managing door locks
  - Controller 2: Wade Building (11 doors)
  - Controller 3: Main Church (19 doors)
  - Controller 4: Student Building (13 doors)
  - Controller 5: PCB (11 doors)
  - Controllers 1, 6: Other doors
- Database tables: `HW_Controllers`, `HW_Devices`, `TS_DoorSchedules`, `AL_AccessLevel`

**MonitorCast Web Interface:**
- ASP.NET MVC application (Port 8080)
- Web UI for VIA system
- **Quick Controls API:** `POST /Dashboard/LockUnlockDoor`
- Authentication: Cookie-based sessions
- We will ONLY use the Quick Controls API - no direct VIA database writes

### Critical Constraints

⚠️ **ABSOLUTE RULE: READ-ONLY ACCESS TO VIA DATABASE**
- Writing to VIA database is TOO RISKY (learned from previous attempts)
- Can crash MonitorCast or corrupt controller state
- Only safe interaction: Quick Controls API

⚠️ **Known VIA System Quirks:**
- Door Schedules and Access Levels are SEPARATE conflicting systems
- Controllers cache schedules unpredictably
- Setting `ControllerGroupID=NULL` crashes MonitorCast
- No priority mechanism for overlapping schedules

---

## Technical Stack

### Backend
- **Framework:** ASP.NET Core 8.0 Web API
- **Language:** C# 12
- **Database:** SQL Server (FBCADoorControl)
- **ORM:** Entity Framework Core 8.0
- **Background Services:** Hosted Services for scheduling
- **HTTP Client:** MonitorCast Quick Controls API integration

### Frontend
- **UI Library:** FullCalendar 6.x (JavaScript)
- **Framework:** Vanilla HTML/CSS/JS (served as static files)
- **Styling:** Bootstrap 5.3
- **Date Handling:** Moment.js

### Infrastructure
- **Hosting:** Windows Server (FBCA internal network)
- **Port:** 5002 (HTTP)
- **Database Server:** FBCA SQL Server instance
- **Integration:** MonitorCast (localhost:8080)

### Development Tools
- **IDE:** Visual Studio 2022 / VS Code
- **Package Manager:** NuGet
- **Version Control:** Git (local workspace)

---

## Data Architecture

### Our Database: FBCADoorControl

**Tables:**

1. **Doors** - Synced copy of VIA doors (read-only sync)
   - Primary Key: `DoorID` (int, identity)
   - Foreign Key: `VIADeviceID` (links to VIA `HW_Devices.DeviceID`)
   - Fields: `DoorName`, `ControllerID`, `ControllerName`, `IsActive`, `LastSyncTime`

2. **UnlockSchedules** - Our schedule management
   - Primary Key: `ScheduleID` (int, identity)
   - Foreign Key: `DoorID` (links to Doors table)
   - Fields: `StartTime`, `EndTime`, `RecurrencePattern`, `Source` (Manual/PCO), `IsActive`, `CreatedBy`, `CreatedAt`

3. **ScheduleActionLog** - Complete audit trail
   - Primary Key: `ActionID` (int, identity)
   - Foreign Key: `ScheduleID`, `DoorID`
   - Fields: `ActionType` (Unlock/Lock), `ActionTime`, `Success`, `ErrorMessage`, `TriggeredBy` (Schedule/Manual/System)

### External Database: VIAC (READ-ONLY)

**Tables We Read From:**
- `HW_Controllers` - Door controller info
- `HW_Devices` - Physical door devices
- (Optional) `Events` - Door activity logs

**Tables We NEVER Write To:**
- ❌ `TS_DoorSchedules` (use Quick Controls API instead)
- ❌ `TS_TimeZones` (use Quick Controls API instead)
- ❌ Anything else

---

## API Contracts

### Our API Endpoints

**Schedules Management:**
```
GET    /api/schedules              - List all schedules (with filtering)
GET    /api/schedules/{id}         - Get schedule details
POST   /api/schedules              - Create new schedule
PUT    /api/schedules/{id}         - Update schedule
DELETE /api/schedules/{id}         - Delete schedule
```

**Doors Management:**
```
GET    /api/doors                  - List all doors
GET    /api/doors/{id}             - Get door details
POST   /api/sync-doors             - Sync doors from VIA database
POST   /api/test-quick-controls/{id} - Test immediate unlock/lock
```

**System Health:**
```
GET    /api/health                 - System health check
GET    /api/schedule-actions       - View action log (audit trail)
```

### MonitorCast Quick Controls API

**Endpoint:**
```
POST http://localhost:8080/Dashboard/LockUnlockDoor
Content-Type: application/x-www-form-urlencoded
Cookie: [Session cookies from login]

Body:
deviceIDs={deviceID}&action=unlock  // or action=lock
```

**Authentication Flow:**
1. POST to `/Account/Login` with credentials
2. Store session cookies (`ASP.NET_SessionId`, `.ASPXAUTH`)
3. Include cookies in all Quick Controls requests
4. Re-authenticate if session expires (401 response)

---

## Security & Permissions

### Authentication
- **Phase 1-2:** No auth (internal network only)
- **Phase 3:** Consider AD/SSO integration

### Authorization
- **Phase 1-2:** All users can create/delete schedules
- **Phase 3:** Role-based permissions (Admin, Staff, Viewer)

### Audit Logging
- ✅ ALL door actions logged to `ScheduleActionLog`
- ✅ Include: Who, What, When, Success/Failure, Reason
- ✅ Immutable log (no deletes, only inserts)

### Data Protection
- ✅ MonitorCast credentials stored in `appsettings.json` (not in code)
- ✅ Connection strings in environment variables or secure config
- ✅ No sensitive data exposed in API responses

---

## Risks & Mitigation

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| MonitorCast session expires | HIGH | Re-authenticate automatically on 401 |
| VIA controller offline | MEDIUM | Retry logic + alert logging |
| Quick Controls API rate limits | MEDIUM | Throttle requests, queue commands |
| Database connection loss | HIGH | Connection retry + graceful degradation |
| Overlapping schedules | MEDIUM | Document expected behavior, allow conflicts |

### Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Staff resistance to new UI | MEDIUM | Training session + clear documentation |
| Doors left unlocked overnight | HIGH | Automated "lock all" failsafe at midnight |
| System downtime during events | HIGH | Health monitoring + manual MonitorCast backup |
| PCO integration complexity | MEDIUM | Phase 3 only - don't block Phase 1-2 |

---

## Non-Functional Requirements

### Performance
- Schedule checks: Every 30 seconds (acceptable latency)
- API response time: <500ms for all endpoints
- Database queries: <100ms for schedule lookups

### Reliability
- **Uptime:** 99% (acceptable for internal tool)
- **Failover:** Manual fallback to MonitorCast if system down
- **Monitoring:** Health endpoint + error logging

### Scalability
- Current: 58 doors, ~50 schedules/week
- Growth: Plan for 100 doors, 200 schedules/week (10-year horizon)

### Usability
- Zero training for basic schedule creation
- Calendar UI familiar to all staff (similar to Outlook/Google Calendar)
- Mobile responsive (staff use tablets)

---

## Out of Scope (Phase 1-2)

❌ Planning Center Online integration (Phase 3)  
❌ Card reader management  
❌ Access level configuration  
❌ Real-time door status display (no sensors)  
❌ Mobile app (web UI is sufficient)  
❌ Historical reporting/analytics (future)  
❌ Integration with other church systems

---

## Success Metrics

### Phase 1 (MVP)
- [ ] Staff can create door unlock schedules in <2 minutes (vs 10 minutes in MonitorCast)
- [ ] Zero manual schedule errors in first 2 weeks
- [ ] 100% of scheduled events have correct door access

### Phase 2 (Production)
- [ ] Complete audit trail for all door actions
- [ ] System uptime >99% for 30 days
- [ ] Staff satisfaction >8/10 (vs current 3/10)

### Phase 3 (Future - PCO Integration)
- [ ] Zero manual schedule creation (100% automated from PCO)
- [ ] Schedules sync within 5 minutes of PCO event creation
- [ ] Automatic handling of event changes/cancellations

---

## Timeline & Milestones

### Phase 1: Core System (Week 1)
- **Day 1:** Database schema + API scaffolding
- **Day 2:** Quick Controls integration + door sync
- **Day 3:** Schedule CRUD API
- **Day 4:** FullCalendar UI
- **Day 5:** Testing + bug fixes

### Phase 2: Automation + Polish (Week 2)
- **Day 1:** Background scheduler service
- **Day 2:** Audit logging
- **Day 3:** Error handling + monitoring
- **Day 4:** Documentation + deployment prep
- **Day 5:** User acceptance testing

### Phase 3: PCO Integration (Future)
- TBD (requires PCO API access + planning)

---

## Assumptions

1. MonitorCast Quick Controls API is stable and won't change
2. FBCA SQL Server has capacity for new database
3. Windows Server hosting environment available
4. Staff have basic web browser access (Chrome/Edge)
5. VIA hardware controllers remain unchanged
6. MonitorCast stays running (our system depends on it)

---

## Dependencies

### External Systems
- MonitorCast (localhost:8080) - MUST be running
- VIA Access Control database - MUST be accessible (read-only)
- FBCA SQL Server - MUST be available

### External Services (Phase 3)
- Planning Center Online API - TBD

### Development Tools
- .NET 8 SDK installed
- SQL Server Management Studio (SSMS)
- Git for version control

---

## Approval & Sign-off

**Architect:** Cornerstone (AI Agent 1)  
**Project Owner:** Billy Nelms  
**Approved:** [Pending Billy's review]

**Next Steps:**
1. Billy reviews and approves this spec
2. Hand off to Agent 2 (Builder) for implementation
3. Begin Phase 1 development

---

_Generated by Agent 1 (Architect) - February 11, 2026 8:30 PM CST_
