# FBCA Door Control System - Development Task List

**Generated:** February 11, 2026 8:45 PM CST  
**Architect:** Cornerstone (AI Agent 1)

---

## Priority Legend
- **P0** - Critical (must have for MVP)
- **P1** - High priority (important for production)
- **P2** - Nice to have (future enhancement)

## Complexity Estimate
- **S** - Small (< 2 hours)
- **M** - Medium (2-4 hours)
- **L** - Large (4-8 hours)

---

## Phase 1: Core System (Week 1)

### 1. Project Setup & Infrastructure [P0]

- [P0, S] **Task 1.1:** Create ASP.NET Core Web API project
  - Dependencies: None
  - Deliverable: `dotnet new webapi -n FBCADoorControl`
  
- [P0, S] **Task 1.2:** Configure project structure (folders)
  - Dependencies: Task 1.1
  - Deliverable: Controllers/, Services/, Data/, Models/, wwwroot/ folders
  
- [P0, S] **Task 1.3:** Install NuGet packages
  - Dependencies: Task 1.1
  - Deliverable: EF Core, SQL Server provider, Newtonsoft.Json
  - Command: `dotnet add package Microsoft.EntityFrameworkCore.SqlServer`
  
- [P0, S] **Task 1.4:** Create appsettings.json with connection strings
  - Dependencies: Task 1.1
  - Deliverable: FBCADoorControl and VIAC connection strings configured

---

### 2. Database Layer [P0]

- [P0, M] **Task 2.1:** Create Door entity model
  - Dependencies: Task 1.2
  - Deliverable: `Models/Door.cs` with all fields
  
- [P0, M] **Task 2.2:** Create UnlockSchedule entity model
  - Dependencies: Task 1.2
  - Deliverable: `Models/UnlockSchedule.cs` with all fields
  
- [P0, M] **Task 2.3:** Create ScheduleActionLog entity model
  - Dependencies: Task 1.2
  - Deliverable: `Models/ScheduleActionLog.cs` with all fields
  
- [P0, M] **Task 2.4:** Create DoorControlDbContext
  - Dependencies: Task 2.1, 2.2, 2.3
  - Deliverable: `Data/DoorControlDbContext.cs` with DbSets and configuration
  
- [P0, S] **Task 2.5:** Create VIACDbContext (read-only)
  - Dependencies: Task 1.2
  - Deliverable: `Data/VIACDbContext.cs` with VIA table models
  
- [P0, M] **Task 2.6:** Generate and run initial migration
  - Dependencies: Task 2.4
  - Deliverable: Database created with all tables
  - Command: `dotnet ef migrations add InitialCreate`

---

### 3. MonitorCast Integration [P0]

- [P0, M] **Task 3.1:** Create QuickControlsService interface
  - Dependencies: Task 1.2
  - Deliverable: `Services/IQuickControlsService.cs`
  
- [P0, L] **Task 3.2:** Implement QuickControlsService
  - Dependencies: Task 3.1
  - Deliverable: `Services/QuickControlsService.cs`
  - Features: Auth, unlock, lock, session management, retry logic
  
- [P0, S] **Task 3.3:** Create MonitorCast configuration model
  - Dependencies: Task 1.4
  - Deliverable: Add MonitorCast section to appsettings.json
  
- [P0, M] **Task 3.4:** Test QuickControlsService with real door
  - Dependencies: Task 3.2
  - Deliverable: Manual test confirming unlock/lock works

---

### 4. Door Sync Service [P0]

- [P0, M] **Task 4.1:** Create DoorSyncService interface
  - Dependencies: Task 1.2
  - Deliverable: `Services/IDoorSyncService.cs`
  
- [P0, L] **Task 4.2:** Implement DoorSyncService
  - Dependencies: Task 4.1, Task 2.5
  - Deliverable: `Services/DoorSyncService.cs`
  - Features: Read VIA database, sync to our Doors table
  
- [P0, M] **Task 4.3:** Test door sync with VIA database
  - Dependencies: Task 4.2
  - Deliverable: Verify 58 doors loaded correctly

---

### 5. Schedules API [P0]

- [P0, S] **Task 5.1:** Create ScheduleDto model
  - Dependencies: Task 1.2
  - Deliverable: `Models/DTOs/ScheduleDto.cs`
  
- [P0, M] **Task 5.2:** Create SchedulesController
  - Dependencies: Task 5.1, Task 2.4
  - Deliverable: `Controllers/SchedulesController.cs` with GET, POST, DELETE endpoints
  
- [P0, M] **Task 5.3:** Implement GET /api/schedules
  - Dependencies: Task 5.2
  - Deliverable: List schedules with filtering
  
- [P0, M] **Task 5.4:** Implement POST /api/schedules
  - Dependencies: Task 5.2
  - Deliverable: Create schedule with validation
  
- [P0, S] **Task 5.5:** Implement DELETE /api/schedules/{id}
  - Dependencies: Task 5.2
  - Deliverable: Delete schedule by ID
  
- [P0, M] **Task 5.6:** Test Schedules API with Postman/curl
  - Dependencies: Task 5.3, 5.4, 5.5
  - Deliverable: All CRUD operations working

---

### 6. Doors API [P0]

- [P0, S] **Task 6.1:** Create DoorDto model
  - Dependencies: Task 1.2
  - Deliverable: `Models/DTOs/DoorDto.cs`
  
- [P0, M] **Task 6.2:** Create DoorsController
  - Dependencies: Task 6.1, Task 2.4
  - Deliverable: `Controllers/DoorsController.cs` with GET, POST endpoints
  
- [P0, S] **Task 6.3:** Implement GET /api/doors
  - Dependencies: Task 6.2
  - Deliverable: List all doors with filtering
  
- [P0, M] **Task 6.4:** Implement POST /api/sync-doors
  - Dependencies: Task 6.2, Task 4.2
  - Deliverable: Trigger door sync from VIA
  
- [P0, M] **Task 6.5:** Implement POST /api/test-quick-controls/{id}
  - Dependencies: Task 6.2, Task 3.2
  - Deliverable: Test immediate unlock/lock
  
- [P0, M] **Task 6.6:** Test Doors API with Postman/curl
  - Dependencies: Task 6.3, 6.4, 6.5
  - Deliverable: All operations working

---

### 7. Health Check API [P0]

- [P0, S] **Task 7.1:** Create HealthController
  - Dependencies: Task 1.2
  - Deliverable: `Controllers/HealthController.cs`
  
- [P0, M] **Task 7.2:** Implement GET /api/health
  - Dependencies: Task 7.1
  - Deliverable: Check database, VIA, MonitorCast, scheduler
  
- [P0, S] **Task 7.3:** Test health endpoint
  - Dependencies: Task 7.2
  - Deliverable: Verify status=Healthy

---

### 8. FullCalendar UI [P0]

- [P0, S] **Task 8.1:** Create static file structure
  - Dependencies: Task 1.2
  - Deliverable: wwwroot/index.html, calendar.html, css/, js/
  
- [P0, M] **Task 8.2:** Implement calendar.html
  - Dependencies: Task 8.1
  - Deliverable: FullCalendar library integrated
  
- [P0, M] **Task 8.3:** Implement calendar.js
  - Dependencies: Task 8.2, Task 5.6
  - Deliverable: Load schedules from API, render on calendar
  
- [P0, M] **Task 8.4:** Implement schedule creation UI
  - Dependencies: Task 8.3
  - Deliverable: Click calendar → modal → create schedule
  
- [P0, S] **Task 8.5:** Implement schedule deletion UI
  - Dependencies: Task 8.3
  - Deliverable: Click event → delete button → confirm → delete
  
- [P0, S] **Task 8.6:** Style calendar with Bootstrap
  - Dependencies: Task 8.2
  - Deliverable: `wwwroot/css/calendar.css`
  
- [P0, M] **Task 8.7:** Test UI end-to-end
  - Dependencies: Task 8.4, 8.5
  - Deliverable: Create/view/delete schedules via UI

---

## Phase 2: Automation & Polish (Week 2)

### 9. Background Scheduler Service [P0]

- [P0, M] **Task 9.1:** Create SchedulerService (IHostedService)
  - Dependencies: Task 1.2
  - Deliverable: `Services/SchedulerService.cs`
  
- [P0, L] **Task 9.2:** Implement schedule execution logic
  - Dependencies: Task 9.1, Task 2.4, Task 3.2
  - Deliverable: Check schedules every 30 seconds, execute unlock/lock
  
- [P0, M] **Task 9.3:** Implement action logging
  - Dependencies: Task 9.2, Task 2.3
  - Deliverable: Log every action to ScheduleActionLog
  
- [P0, M] **Task 9.4:** Implement idempotency checks
  - Dependencies: Task 9.2
  - Deliverable: Don't re-unlock already unlocked doors
  
- [P0, M] **Task 9.5:** Test scheduler with real schedules
  - Dependencies: Task 9.2
  - Deliverable: Verify doors unlock/lock automatically

---

### 10. Error Handling & Logging [P1]

- [P1, M] **Task 10.1:** Create ErrorHandlingMiddleware
  - Dependencies: Task 1.2
  - Deliverable: `Middleware/ErrorHandlingMiddleware.cs`
  
- [P1, S] **Task 10.2:** Configure global error responses
  - Dependencies: Task 10.1
  - Deliverable: Consistent error JSON format
  
- [P1, S] **Task 10.3:** Configure file logging
  - Dependencies: None
  - Deliverable: Logs written to `/logs/fbca-door-control.log`
  
- [P1, M] **Task 10.4:** Add logging to all services
  - Dependencies: Task 10.3
  - Deliverable: ILogger injected and used in all services

---

### 11. Audit Trail & Monitoring [P1]

- [P1, S] **Task 11.1:** Create ActionLogDto model
  - Dependencies: Task 1.2
  - Deliverable: `Models/DTOs/ActionLogDto.cs`
  
- [P1, M] **Task 11.2:** Add GET /api/schedule-actions endpoint
  - Dependencies: Task 11.1
  - Deliverable: View action log with filtering
  
- [P1, M] **Task 11.3:** Add action log UI page (optional)
  - Dependencies: Task 11.2
  - Deliverable: `wwwroot/audit-log.html`

---

### 12. Testing & Bug Fixes [P0]

- [P0, M] **Task 12.1:** Manual testing checklist
  - Dependencies: All previous tasks
  - Deliverable: Test door sync, schedule CRUD, scheduler, UI
  
- [P0, L] **Task 12.2:** Fix discovered bugs
  - Dependencies: Task 12.1
  - Deliverable: All P0/P1 bugs resolved
  
- [P0, M] **Task 12.3:** Performance testing
  - Dependencies: Task 12.1
  - Deliverable: Verify <500ms API response, 30-second scheduler loop

---

### 13. Documentation [P1]

- [P1, M] **Task 13.1:** Write README.md
  - Dependencies: None
  - Deliverable: Setup instructions, API docs, deployment guide
  
- [P1, S] **Task 13.2:** Create .env.example
  - Dependencies: Task 1.4
  - Deliverable: Template for environment variables
  
- [P1, M] **Task 13.3:** Write DEPLOYMENT_CHECKLIST.md
  - Dependencies: Task 13.1
  - Deliverable: Step-by-step deployment guide

---

### 14. Deployment [P0]

- [P0, M] **Task 14.1:** Publish application
  - Dependencies: Task 12.2
  - Deliverable: `dotnet publish -c Release`
  
- [P0, M] **Task 14.2:** Set up IIS or Kestrel hosting
  - Dependencies: Task 14.1
  - Deliverable: Application running on port 5001
  
- [P0, S] **Task 14.3:** Run database migrations in production
  - Dependencies: Task 14.2
  - Deliverable: FBCADoorControl database created
  
- [P0, M] **Task 14.4:** Initial door sync in production
  - Dependencies: Task 14.3
  - Deliverable: 58 doors loaded from VIA
  
- [P0, M] **Task 14.5:** User acceptance testing
  - Dependencies: Task 14.4
  - Deliverable: Staff creates schedules, verifies door unlocks
  
- [P0, S] **Task 14.6:** Go-live sign-off
  - Dependencies: Task 14.5
  - Deliverable: Billy approves production release

---

## Phase 3: PCO Integration (Future)

### 15. Planning Center Online Sync [P1 - Future]

- [P1, M] **Task 15.1:** Research PCO API
  - Dependencies: None
  - Deliverable: API documentation, authentication flow
  
- [P1, L] **Task 15.2:** Create PCOSyncService (IHostedService)
  - Dependencies: Task 15.1
  - Deliverable: `Services/PCOSyncService.cs`
  
- [P1, M] **Task 15.3:** Create PCOLocationMappings table
  - Dependencies: Task 15.2
  - Deliverable: Database table for location → door mapping
  
- [P1, L] **Task 15.4:** Implement event polling logic
  - Dependencies: Task 15.2
  - Deliverable: Poll PCO API every 5 minutes, detect changes
  
- [P1, M] **Task 15.5:** Implement auto-schedule creation
  - Dependencies: Task 15.4
  - Deliverable: PCO event → UnlockSchedule
  
- [P1, M] **Task 15.6:** Implement event change/cancellation handling
  - Dependencies: Task 15.5
  - Deliverable: Update/delete schedules when PCO events change
  
- [P1, M] **Task 15.7:** Test PCO integration end-to-end
  - Dependencies: Task 15.6
  - Deliverable: Create PCO event → door unlocks automatically

---

## Risks & Blockers

### High Risk
- ⚠️ **Task 3.2** - MonitorCast API behavior may differ from documentation (mitigation: test early)
- ⚠️ **Task 9.2** - Scheduler reliability critical for production (mitigation: extensive testing)

### Medium Risk
- ⚠️ **Task 4.2** - VIA database schema may change (mitigation: read-only, low risk)
- ⚠️ **Task 8.7** - UI complexity may require more time (mitigation: MVP features only)

### Dependencies
- MonitorCast must remain running (no control over this)
- VIA database must remain accessible (FBCA IT dependency)
- SQL Server must have capacity for new database (FBCA IT dependency)

---

## Definition of Done

A task is "Done" when:
1. ✅ Code is written and tested
2. ✅ No P0/P1 bugs remain
3. ✅ Code is commented (non-obvious logic)
4. ✅ DEVLOG.md entry written (for major tasks)
5. ✅ Integration tested with dependent components
6. ✅ Handoff to next agent (if applicable)

---

## Handoff to Builder

**Agent 1 (Architect) Status:** ✅ Complete

**Deliverables:**
- ✅ PROJECT_SPEC.md
- ✅ ARCHITECTURE.md
- ✅ TASK_LIST.md

**Next Steps:**
1. Billy reviews and approves architecture
2. Agent 2 (Builder) begins implementation starting with Task 1.1
3. Builder follows task list sequentially, completing P0 tasks first

**Architect's Notes for Builder:**
- Focus on Phase 1 tasks (1.1 through 8.7) for MVP
- Don't skip Task 3.4 and 4.3 (critical integration tests)
- Task 9.2 (scheduler logic) is most complex - allocate adequate time
- Defer Phase 3 tasks (15.x) - don't block on PCO integration

**Estimated Timeline:**
- Phase 1: 5-7 days (40-50 hours)
- Phase 2: 3-4 days (20-30 hours)
- **Total MVP:** ~10 days to production-ready

---

_Generated by Agent 1 (Architect) - February 11, 2026 8:50 PM CST_  
**Ready for handoff to Agent 2 (Builder)**
