# Planning Center Online (PCO) API Documentation

**Added:** 2026-02-13 12:29 AM CST  
**Purpose:** Phase 3 integration - Automatic door unlocking based on PCO Calendar events

---

## What This Is

Planning Center Online (PCO) is FBCA's event management system. These docs provide everything needed to integrate PCO Calendar with our door control system.

**The Vision (Phase 3):**
> "When someone schedules an event in Planning Center Online, the doors automatically unlock and lock at the right times, without anyone manually creating schedules."

---

## Documentation Index

| File | Purpose |
|------|---------|
| `00-pco-integration-skill.md` | Overview of when/how to use PCO API |
| `01-api-overview.md` | Authentication, base URLs, JSON:API spec, rate limits |
| `02-calendar-api.md` | **MOST IMPORTANT** - Events, rooms, resources, approvals |
| `03-common-patterns.md` | Pagination, filtering, error handling, date handling |
| `04-fbca-specifics.md` | **FBCA CONFIG** - Approval groups, known rooms, data shapes |
| `05-middleware-patterns.md` | Vercel serverless patterns, webhook ingestion |
| `06-people-api.md` | People lookups (for approval group membership) |

---

## Phase 3 Integration Plan

### Goal
Automatically sync PCO Calendar events to door unlock schedules.

### How It Works
1. **PCO Calendar** → Event created with room booking (e.g., "Sunday Service in FBC Sanctuary")
2. **Webhook/Cron** → Middleware detects new event
3. **Our System** → Automatically creates unlock schedule for those rooms
4. **Doors** → Unlock at event start time, lock at end time

### Key PCO Concepts

**Events vs Event Instances:**
- **Event** = Template (e.g., "Sunday Service")
- **Event Instance** = Actual occurrence (e.g., "Sunday, Jan 14, 2026 at 9 AM")

**Rooms vs Resources:**
- **Rooms** = Physical spaces (FBC Sanctuary, SC 100, etc.)
- **Resources** = Things needed (Building Access, IT Equipment, etc.)

**Approval Groups (FBCA):**
- 139176 = Building Access
- 139181 = IT Equipment
- 139184 = Room Setup
- 139185 = Rooms

### Integration Points

**What We Need from PCO:**
- Event name
- Start/end time
- Rooms booked (with approval status)
- Building Access resource (doors that need unlocking)

**What We Create:**
- `UnlockSchedule` records in our database
- Priority based on event type (worship = high, meeting = normal)
- Automatic unlock/lock via MonitorCast API

### Authentication

**Personal Access Token (simplest):**
```csharp
// appsettings.json
"PCO": {
  "AppId": "your_app_id",
  "Secret": "your_secret",
  "BaseUrl": "https://api.planningcenteronline.com"
}

// HTTP Basic Auth
var credentials = Convert.ToBase64String(
    Encoding.ASCII.GetBytes($"{pcoAppId}:{pcoSecret}")
);
headers.Add("Authorization", $"Basic {credentials}");
```

**Get tokens at:** https://api.planningcenteronline.com/oauth/applications

### Example: Fetch Events with Rooms

From `02-calendar-api.md`:

```
GET /calendar/v2/event_instances?filter=future&per_page=100&include=event
```

For each event:
```
GET /calendar/v2/events/{event_id}/event_resource_requests?include=resource,resource_approval_group&per_page=100
```

Filter for:
- `kind = "Room"` → Physical spaces
- `approval_status = "A"` → Approved bookings only
- `resource.name` contains "Building Access" → Indicates door unlock needed

### Door Mapping Strategy

**Option 1: Room Name → Door Mapping (Simple)**
```csharp
// Map PCO room names to our Door IDs
var roomToDoorMap = new Dictionary<string, int[]>
{
    { "FBC Sanctuary", new[] { 1, 2, 3 } },  // Main entrance, side doors
    { "SC 100", new[] { 101, 102 } },         // PCB-F2-DBL, etc.
    // ...
};
```

**Option 2: "Building Access" Resource Answers (Advanced)**

Check Q&A answers for Building Access resource:
- Question: "Which doors need unlocking?"
- Answer: "Main entrance, Student Center entrance"

Parse answers and map to door names.

### Sync Frequency

**Phase 3A (Manual trigger):**
- Admin clicks "Sync from PCO" button
- Fetches next 14 days of events
- Creates schedules for approved events

**Phase 3B (Automated):**
- Webhook from PCO when events change
- Or cron job every 15 minutes
- Updates schedules automatically

### Data Flow Example

```
PCO Calendar Event:
- Name: "Wednesday Night Service"
- Time: 2026-01-15 18:00 - 20:00
- Room: FBC Sanctuary (approved)
- Resource: Building Access (approved, answers: "Main entrance, 5:30 PM unlock")

↓ Sync ↓

Our System Schedule:
- ScheduleName: "PCO: Wednesday Night Service"
- DoorID: 1 (Main entrance)
- StartTime: 2026-01-15 17:30 (30 min before)
- EndTime: 2026-01-15 20:30 (30 min after)
- Priority: 10 (event unlock, high priority)
- Source: "PCO"
```

### Implementation Checklist

Phase 3 tasks:
- [ ] Set up PCO API credentials
- [ ] Create PCO sync service (read-only)
- [ ] Build room name → door mapping
- [ ] Create "Sync from PCO" API endpoint
- [ ] Add "Source = PCO" to UnlockSchedules table
- [ ] UI indicator for PCO-sourced schedules
- [ ] Webhook receiver for PCO changes (Phase 3B)
- [ ] Two-way sync: approval status → PCO comments (Phase 3C)

---

## When to Reference These Docs

**Right now:** Understanding FBCA's approval groups and room names (see `04-fbca-specifics.md`)

**Phase 3 start:** Authentication, event fetching patterns (`01-api-overview.md`, `02-calendar-api.md`)

**Phase 3 advanced:** Webhooks, middleware patterns, Q&A parsing (`05-middleware-patterns.md`)

---

## Related Project Files

- `PROJECT_SPEC.md` - Phase 3 defined here
- `ARCHITECTURE.md` - Future PCO integration layer
- `Models/UnlockSchedule.cs` - Will add `Source` field for "PCO" vs "Manual"

---

**Status:** Reference documentation saved for Phase 3 implementation.
