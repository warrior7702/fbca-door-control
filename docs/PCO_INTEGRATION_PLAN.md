# Planning Center Online (PCO) Integration Plan - Phase 3

**Document Version:** 1.0  
**Created:** February 13, 2026  
**Author:** OpenClaw Subagent (PCO API Expert)  
**Project:** FBCA Door Control System  
**Purpose:** Detailed implementation plan for automatic door scheduling from PCO Calendar events

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Integration Architecture](#integration-architecture)
3. [PCO Calendar Data Model](#pco-calendar-data-model)
4. [Data Mapping Strategy](#data-mapping-strategy)
5. [C# PCO API Client](#c-pco-api-client)
6. [Room-to-Door Mapping](#room-to-door-mapping)
7. [Sync Strategies](#sync-strategies)
8. [Implementation Phases](#implementation-phases)
9. [Error Handling & Edge Cases](#error-handling--edge-cases)
10. [Security & Authentication](#security--authentication)
11. [Testing Strategy](#testing-strategy)
12. [Monitoring & Observability](#monitoring--observability)
13. [Questions & Gaps](#questions--gaps)
14. [Next Steps](#next-steps)

---

## Executive Summary

### Vision

> **"When someone schedules an event in Planning Center Online, the doors automatically unlock and lock at the right times, without anyone manually creating schedules."**

### Goals

1. **Eliminate manual door scheduling** - 100% automation from PCO Calendar events
2. **Reliable sync** - Events sync within 5-15 minutes of changes in PCO
3. **Smart door mapping** - Automatically determine which doors to unlock based on event rooms
4. **Approval-aware** - Only sync approved events with approved room bookings
5. **Audit trail** - Track which schedules came from PCO vs manual entry

### Key Benefits

- **Time Savings:** Eliminate ~2 hours/week of manual schedule creation
- **Error Reduction:** No more forgotten or misconfigured schedules
- **Better Security:** Doors only unlock when actually needed
- **Event Integration:** Single source of truth (PCO) for all church events

### Success Metrics

| Metric | Target |
|--------|--------|
| Events auto-scheduled | >95% of PCO events |
| Sync latency | <15 minutes from PCO change |
| Schedule accuracy | 100% (right doors, right times) |
| Staff manual intervention | <5% of events |
| System uptime | >99% |

---

## Integration Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Planning Center Online                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Events     │  │    Rooms     │  │  Resources   │          │
│  │ (occurrences)│  │  (physical)  │  │ (approval    │          │
│  └──────────────┘  └──────────────┘  │  groups)     │          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    PCO Calendar API v2
                    (JSON:API, REST)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              FBCA Door Control System (.NET 8)                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PCO Sync Service (IHostedService)                       │  │
│  │  - Periodic polling (every 15 min) OR webhook listener   │  │
│  │  - Fetch approved events with room bookings              │  │
│  │  - Map PCO rooms → Door IDs                              │  │
│  │  - Create/update UnlockSchedule records                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Database: FBCADoorControl                               │  │
│  │  - UnlockSchedule (Source = "PCO")                       │  │
│  │  - Door (room name mapping)                              │  │
│  │  - PCOEventCache (track synced events)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Scheduler Service (existing)                            │  │
│  │  - Monitors UnlockSchedule (ALL sources)                 │  │
│  │  - Executes lock/unlock via MonitorCast API              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    MonitorCast Quick Controls API
                              ↓
                    VIA Access Control Hardware
                              ↓
                    Physical Door Locks (58 doors)
```

### Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **PCO Calendar** | Source of truth for events | SaaS (Planning Center) |
| **PCO API Client** | Fetch event/room/resource data | C# HttpClient, JSON parsing |
| **PCO Sync Service** | Background service, orchestrates sync | IHostedService (PeriodicTimer) |
| **Room Mapper** | PCO room name → Door ID(s) | Configuration-based dictionary |
| **Schedule Creator** | UnlockSchedule CRUD | Entity Framework Core |
| **Event Cache** | Track synced events, detect changes | SQL Server table |
| **Scheduler Service** | Execute schedules (EXISTING) | IHostedService (already built) |

---

## PCO Calendar Data Model

### Key PCO Resources

#### 1. Event Instances (Actual Occurrences)

PCO distinguishes between:
- **Events** = Templates (e.g., "Sunday Worship Service")
- **Event Instances** = Actual occurrences with dates (e.g., "Sunday, Feb 16, 2026 at 9:00 AM")

We care about **Event Instances** because they have the actual datetime.

**API Endpoint:**
```
GET /calendar/v2/event_instances?filter=future&per_page=100&include=event
```

**Key Fields:**
```json
{
  "id": "123456",
  "type": "EventInstance",
  "attributes": {
    "starts_at": "2026-02-16T15:00:00Z",
    "ends_at": "2026-02-16T17:00:00Z",
    "all_day_event": false
  },
  "relationships": {
    "event": {
      "data": { "type": "Event", "id": "78901" }
    }
  }
}
```

#### 2. Events (Metadata)

Contains event name, description, approval status.

**API Endpoint:**
```
GET /calendar/v2/events/{id}
```

**Key Fields:**
```json
{
  "id": "78901",
  "type": "Event",
  "attributes": {
    "name": "Wednesday Night Service",
    "description": "<p>Weekly service</p>",
    "approval_status": "A",  // A=Approved, P=Pending, D=Declined
    "percent_approved": 100
  }
}
```

**IMPORTANT:** We only sync events where `approval_status = "A"` (Approved).

#### 3. Event Resource Requests (Room Bookings)

Each event can request multiple rooms/resources. Each request has its own approval status.

**API Endpoint:**
```
GET /calendar/v2/events/{event_id}/event_resource_requests?include=resource,resource_approval_group&per_page=100
```

**Key Fields:**
```json
{
  "id": "31970985",
  "type": "EventResourceRequest",
  "attributes": {
    "approval_status": "A",
    "quantity": 1,
    "starts_at": "2026-02-16T14:30:00Z",  // May differ from event start!
    "ends_at": "2026-02-16T17:30:00Z"
  },
  "relationships": {
    "resource": {
      "data": { "type": "Resource", "id": "723185" }
    },
    "resource_approval_group": {
      "data": { "type": "ResourceApprovalGroup", "id": "139185" }
    }
  }
}
```

**IMPORTANT:** Room bookings can have different start/end times than the event itself (setup/teardown time).

#### 4. Resources (Rooms & Equipment)

**API Endpoint (via includes):**
```json
{
  "id": "723185",
  "type": "Resource",
  "attributes": {
    "name": "SC 100",
    "kind": "Room"  // or "Resource"
  }
}
```

**Room vs Resource:**
- **kind = "Room"** → Physical space (FBC Sanctuary, SC 100, etc.)
- **kind = "Resource"** → Equipment or approval category (Building Access, IT Equipment, etc.)

**FBCA Specific:**
We care about:
1. **Rooms with kind="Room"** → Map to door IDs
2. **"Building Access" resource** → Indicates doors need unlocking (approval group 139176)

#### 5. Resource Approval Groups

FBCA has these approval groups:

| ID | Name | Purpose |
|----|------|---------|
| 139176 | Building Access | Controls door access |
| 139181 | IT Equipment | AV/tech needs |
| 139184 | Room Setup | Furniture setup |
| 139185 | Rooms | Room reservations |

**API Endpoint:**
```
GET /calendar/v2/resource_approval_groups
```

#### 6. Resource Request Answers (Q&A)

Events can have Q&A answers for each resource request (e.g., "Which doors?", "What time?").

**API Endpoint:**
```
GET /calendar/v2/event_resource_requests/{id}/answers?per_page=100
```

**Example:**
```json
{
  "attributes": {
    "question": {
      "question": "Which doors need unlocking?",
      "kind": "dropdown",
      "choices": "Main Entrance|Student Center|All Entrances"
    },
    "answer": "|Student Center"  // Note: leading pipe for dropdown answers
  }
}
```

**Phase 3B Feature:** Parse answers to determine specific doors (advanced mapping).

---

## Data Mapping Strategy

### PCO Event → UnlockSchedule Mapping

#### Basic Mapping (Phase 3A)

For each approved PCO event with approved room bookings:

```
PCO Event Instance:
  - Name: "Wednesday Night Service"
  - Starts: 2026-02-19 18:00 (6 PM CST)
  - Ends: 2026-02-19 20:00 (8 PM CST)

PCO Room Booking:
  - Room: "FBC Sanctuary"
  - Approval Status: "A" (Approved)
  - Booking Start: 2026-02-19 17:30 (5:30 PM - setup time)
  - Booking End: 2026-02-19 20:30 (8:30 PM - teardown time)

↓ Mapping ↓

UnlockSchedule Record(s):
  - ScheduleName: "PCO: Wednesday Night Service"
  - DoorID: 1, 2, 3 (Main entrance, side doors for Sanctuary)
  - StartTime: 2026-02-19 17:30 (use booking start, not event start)
  - EndTime: 2026-02-19 20:30 (use booking end, not event end)
  - Priority: 5 (normal event priority)
  - Source: "PCO"
  - IsActive: true
  - CreatedBy: "PCO Sync Service"
```

#### Multiple Rooms → Multiple Schedules

If an event has 3 rooms (SC 100, SC 101, FBC Sanctuary), create separate UnlockSchedule records for each room's doors.

```csharp
foreach (var room in approvedRooms)
{
    var doorIds = GetDoorIdsForRoom(room.Name);
    foreach (var doorId in doorIds)
    {
        CreateOrUpdateSchedule(doorId, room.StartTime, room.EndTime, eventName);
    }
}
```

#### Time Adjustments

**Buffer Time:** Consider adding buffer time for setup/teardown:
- **Before Event:** +30 minutes (unlock early for setup)
- **After Event:** +30 minutes (lock late for cleanup)

**HOWEVER:** PCO room bookings already include this! Use the **booking start/end times**, not the event start/end times.

```csharp
// Use these times from EventResourceRequest:
var unlockTime = resourceRequest.StartsAt; // Already includes setup time
var lockTime = resourceRequest.EndsAt;     // Already includes teardown time
```

#### Priority Mapping

| Event Type | Priority | Notes |
|------------|----------|-------|
| Worship Services | 10 | High priority, cannot be overridden |
| Staff Meetings | 5 | Normal priority |
| External Rentals | 5 | Normal priority |
| Emergency Events | 15 | Highest priority (manual only) |

**Phase 3A:** Default all PCO events to priority 5 (normal).  
**Phase 3B:** Detect event type from name/category and assign priority.

---

## C# PCO API Client

### Configuration

**appsettings.json:**
```json
{
  "PCO": {
    "BaseUrl": "https://api.planningcenteronline.com",
    "AppId": "your_pco_app_id",
    "Secret": "your_pco_secret",
    "SyncIntervalMinutes": 15,
    "SyncWindowDays": 14,
    "MaxEventsPerSync": 100
  }
}
```

**Configuration Class:**
```csharp
namespace FBCADoorControl.Configuration;

public class PcoOptions
{
    public string BaseUrl { get; set; } = "https://api.planningcenteronline.com";
    public string AppId { get; set; } = string.Empty;
    public string Secret { get; set; } = string.Empty;
    public int SyncIntervalMinutes { get; set; } = 15;
    public int SyncWindowDays { get; set; } = 14;
    public int MaxEventsPerSync { get; set; } = 100;

    public string GetBasicAuthHeader()
    {
        var credentials = $"{AppId}:{Secret}";
        var encoded = Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes(credentials));
        return $"Basic {encoded}";
    }
}
```

### PCO API Client Service

**Interface:**
```csharp
namespace FBCADoorControl.Services;

public interface IPcoApiClient
{
    /// <summary>
    /// Fetch event instances in a date window
    /// </summary>
    Task<List<PcoEventInstance>> GetEventInstancesAsync(DateTime startDate, DateTime endDate, int maxEvents = 100);

    /// <summary>
    /// Get event details (name, approval status)
    /// </summary>
    Task<PcoEvent?> GetEventAsync(string eventId);

    /// <summary>
    /// Get room/resource bookings for an event
    /// </summary>
    Task<List<PcoResourceRequest>> GetResourceRequestsAsync(string eventId);

    /// <summary>
    /// Get Q&A answers for a resource request
    /// </summary>
    Task<List<PcoAnswer>> GetAnswersAsync(string resourceRequestId);

    /// <summary>
    /// Health check - verify API credentials
    /// </summary>
    Task<bool> TestConnectionAsync();
}
```

**Implementation:**
```csharp
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;

namespace FBCADoorControl.Services;

public class PcoApiClient : IPcoApiClient
{
    private readonly HttpClient _httpClient;
    private readonly PcoOptions _options;
    private readonly ILogger<PcoApiClient> _logger;

    public PcoApiClient(HttpClient httpClient, IOptions<PcoOptions> options, ILogger<PcoApiClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;

        // Configure HTTP client
        _httpClient.BaseAddress = new Uri(_options.BaseUrl);
        _httpClient.DefaultRequestHeaders.Authorization = 
            AuthenticationHeaderValue.Parse(_options.GetBasicAuthHeader());
        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/calendar/v2/resource_approval_groups?per_page=1");
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PCO API connection test failed");
            return false;
        }
    }

    public async Task<List<PcoEventInstance>> GetEventInstancesAsync(
        DateTime startDate, DateTime endDate, int maxEvents = 100)
    {
        var startIso = startDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
        var endIso = endDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");

        var url = $"/calendar/v2/event_instances" +
                  $"?filter=future" +
                  $"&where[starts_at][gte]={startIso}" +
                  $"&where[starts_at][lte]={endIso}" +
                  $"&per_page={maxEvents}" +
                  $"&order=starts_at" +
                  $"&include=event";

        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        var jsonDoc = JsonDocument.Parse(content);

        var instances = new List<PcoEventInstance>();
        var dataArray = jsonDoc.RootElement.GetProperty("data");
        var included = jsonDoc.RootElement.TryGetProperty("included", out var inc) 
            ? inc : default;

        foreach (var item in dataArray.EnumerateArray())
        {
            var instance = ParseEventInstance(item, included);
            if (instance != null)
                instances.Add(instance);
        }

        _logger.LogInformation("Fetched {Count} event instances from PCO", instances.Count);
        return instances;
    }

    public async Task<PcoEvent?> GetEventAsync(string eventId)
    {
        var url = $"/calendar/v2/events/{eventId}";
        var response = await _httpClient.GetAsync(url);
        
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Failed to fetch event {EventId}: {Status}", 
                eventId, response.StatusCode);
            return null;
        }

        var content = await response.Content.ReadAsStringAsync();
        var jsonDoc = JsonDocument.Parse(content);
        var data = jsonDoc.RootElement.GetProperty("data");

        return ParseEvent(data);
    }

    public async Task<List<PcoResourceRequest>> GetResourceRequestsAsync(string eventId)
    {
        var url = $"/calendar/v2/events/{eventId}/event_resource_requests" +
                  $"?include=resource,resource_approval_group" +
                  $"&per_page=100";

        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        var jsonDoc = JsonDocument.Parse(content);

        var requests = new List<PcoResourceRequest>();
        var dataArray = jsonDoc.RootElement.GetProperty("data");
        var included = jsonDoc.RootElement.TryGetProperty("included", out var inc) 
            ? inc : default;

        foreach (var item in dataArray.EnumerateArray())
        {
            var request = ParseResourceRequest(item, included);
            if (request != null)
                requests.Add(request);
        }

        _logger.LogInformation("Fetched {Count} resource requests for event {EventId}", 
            requests.Count, eventId);
        return requests;
    }

    public async Task<List<PcoAnswer>> GetAnswersAsync(string resourceRequestId)
    {
        var url = $"/calendar/v2/event_resource_requests/{resourceRequestId}/answers?per_page=100";

        var response = await _httpClient.GetAsync(url);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Failed to fetch answers for resource request {Id}", resourceRequestId);
            return new List<PcoAnswer>();
        }

        var content = await response.Content.ReadAsStringAsync();
        var jsonDoc = JsonDocument.Parse(content);

        var answers = new List<PcoAnswer>();
        var dataArray = jsonDoc.RootElement.GetProperty("data");

        foreach (var item in dataArray.EnumerateArray())
        {
            var answer = ParseAnswer(item);
            if (answer != null)
                answers.Add(answer);
        }

        return answers;
    }

    // Helper methods for JSON parsing
    private PcoEventInstance? ParseEventInstance(JsonElement item, JsonElement included)
    {
        try
        {
            var id = item.GetProperty("id").GetString();
            var attrs = item.GetProperty("attributes");
            
            var startsAt = attrs.GetProperty("starts_at").GetString();
            var endsAt = attrs.GetProperty("ends_at").GetString();
            var allDay = attrs.TryGetProperty("all_day_event", out var ad) && ad.GetBoolean();

            // Get event ID from relationship
            var eventRel = item.GetProperty("relationships")
                .GetProperty("event")
                .GetProperty("data");
            var eventId = eventRel.GetProperty("id").GetString();

            // Find event in included data
            string? eventName = null;
            string? approvalStatus = null;

            foreach (var inc in included.EnumerateArray())
            {
                if (inc.GetProperty("type").GetString() == "Event" &&
                    inc.GetProperty("id").GetString() == eventId)
                {
                    var eventAttrs = inc.GetProperty("attributes");
                    eventName = eventAttrs.GetProperty("name").GetString();
                    approvalStatus = eventAttrs.GetProperty("approval_status").GetString();
                    break;
                }
            }

            return new PcoEventInstance
            {
                Id = id!,
                EventId = eventId!,
                EventName = eventName ?? "Unknown Event",
                StartsAt = DateTime.Parse(startsAt!),
                EndsAt = DateTime.Parse(endsAt!),
                AllDayEvent = allDay,
                ApprovalStatus = approvalStatus ?? "P"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse event instance");
            return null;
        }
    }

    private PcoEvent? ParseEvent(JsonElement data)
    {
        try
        {
            var id = data.GetProperty("id").GetString();
            var attrs = data.GetProperty("attributes");

            return new PcoEvent
            {
                Id = id!,
                Name = attrs.GetProperty("name").GetString() ?? "Unknown",
                Description = attrs.TryGetProperty("description", out var desc) 
                    ? desc.GetString() : null,
                ApprovalStatus = attrs.GetProperty("approval_status").GetString() ?? "P"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse event");
            return null;
        }
    }

    private PcoResourceRequest? ParseResourceRequest(JsonElement item, JsonElement included)
    {
        try
        {
            var id = item.GetProperty("id").GetString();
            var attrs = item.GetProperty("attributes");

            var approvalStatus = attrs.GetProperty("approval_status").GetString();
            var quantity = attrs.TryGetProperty("quantity", out var q) ? q.GetInt32() : 1;
            
            var startsAt = attrs.TryGetProperty("starts_at", out var st) 
                ? st.GetString() : null;
            var endsAt = attrs.TryGetProperty("ends_at", out var et) 
                ? et.GetString() : null;

            // Get resource details from included
            var resourceRel = item.GetProperty("relationships")
                .GetProperty("resource")
                .GetProperty("data");
            var resourceId = resourceRel.GetProperty("id").GetString();

            string? resourceName = null;
            string? resourceKind = null;

            foreach (var inc in included.EnumerateArray())
            {
                if (inc.GetProperty("type").GetString() == "Resource" &&
                    inc.GetProperty("id").GetString() == resourceId)
                {
                    var resAttrs = inc.GetProperty("attributes");
                    resourceName = resAttrs.GetProperty("name").GetString();
                    resourceKind = resAttrs.TryGetProperty("kind", out var k) 
                        ? k.GetString() : "Resource";
                    break;
                }
            }

            return new PcoResourceRequest
            {
                Id = id!,
                ResourceId = resourceId!,
                ResourceName = resourceName ?? "Unknown Resource",
                ResourceKind = resourceKind ?? "Resource",
                ApprovalStatus = approvalStatus ?? "P",
                Quantity = quantity,
                StartsAt = startsAt != null ? DateTime.Parse(startsAt) : null,
                EndsAt = endsAt != null ? DateTime.Parse(endsAt) : null
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse resource request");
            return null;
        }
    }

    private PcoAnswer? ParseAnswer(JsonElement item)
    {
        try
        {
            var attrs = item.GetProperty("attributes");
            var question = attrs.GetProperty("question");

            var questionText = question.GetProperty("question").GetString();
            var kind = question.TryGetProperty("kind", out var k) 
                ? k.GetString() : "text";
            var answer = attrs.GetProperty("answer").GetString() ?? "";

            // Strip leading pipe from dropdown answers
            if (kind == "dropdown" && answer.StartsWith("|"))
                answer = answer.Substring(1);

            return new PcoAnswer
            {
                Question = questionText ?? "Unknown",
                Answer = answer,
                Kind = kind ?? "text"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse answer");
            return null;
        }
    }
}
```

### Data Models

```csharp
namespace FBCADoorControl.Models.PCO;

public class PcoEventInstance
{
    public string Id { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string EventName { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public bool AllDayEvent { get; set; }
    public string ApprovalStatus { get; set; } = "P"; // A, P, D
}

public class PcoEvent
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ApprovalStatus { get; set; } = "P";
}

public class PcoResourceRequest
{
    public string Id { get; set; } = string.Empty;
    public string ResourceId { get; set; } = string.Empty;
    public string ResourceName { get; set; } = string.Empty;
    public string ResourceKind { get; set; } = "Resource"; // "Room" or "Resource"
    public string ApprovalStatus { get; set; } = "P";
    public int Quantity { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}

public class PcoAnswer
{
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string Kind { get; set; } = "text"; // text, dropdown, number, checkbox
}
```

---

## Room-to-Door Mapping

### Mapping Strategy

PCO rooms (e.g., "FBC Sanctuary") need to map to one or more Door IDs in our system.

**Options:**

1. **Hardcoded Dictionary** (Phase 3A - simplest)
2. **Database Configuration Table** (Phase 3B - flexible)
3. **Q&A Answer Parsing** (Phase 3C - advanced)

### Phase 3A: Hardcoded Mapping

**Configuration Class:**
```csharp
namespace FBCADoorControl.Configuration;

public class RoomDoorMapping
{
    // Static mapping of PCO room names → Door IDs
    private static readonly Dictionary<string, int[]> _mappings = new()
    {
        // Main Church Building
        { "FBC Sanctuary", new[] { 1, 2, 3 } }, // Main entrance, side doors, back entrance
        { "FBC Welcome Center - East Commons", new[] { 4, 5 } },
        { "FBC Welcome Center - South Commons", new[] { 6, 7 } },
        
        // Student Center
        { "SC 100", new[] { 101, 102 } }, // PCB-F2-DBL doors
        { "SC 101", new[] { 103 } },
        { "SC Lobby", new[] { 100, 104 } },
        
        // Wade Building
        { "Wade Building - Conference Room", new[] { 201 } },
        { "Wade Building - Main Hall", new[] { 200, 202 } },
        
        // Gymnasium
        { "Gym - Main", new[] { 300, 301, 302 } },
        
        // Default fallback for unknown rooms
        // TODO: Log warning when this is used
    };

    public static int[] GetDoorIdsForRoom(string pcoRoomName)
    {
        // Exact match
        if (_mappings.TryGetValue(pcoRoomName, out var doorIds))
            return doorIds;

        // Fuzzy match (contains)
        foreach (var kvp in _mappings)
        {
            if (pcoRoomName.Contains(kvp.Key, StringComparison.OrdinalIgnoreCase) ||
                kvp.Key.Contains(pcoRoomName, StringComparison.OrdinalIgnoreCase))
            {
                return kvp.Value;
            }
        }

        // No match - log warning and return empty array
        // Logger.LogWarning("No door mapping found for PCO room: {RoomName}", pcoRoomName);
        return Array.Empty<int>();
    }

    public static bool HasMapping(string pcoRoomName)
    {
        return GetDoorIdsForRoom(pcoRoomName).Length > 0;
    }
}
```

### Phase 3B: Database Configuration Table

**New Database Table:**
```sql
CREATE TABLE RoomDoorMappings (
    MappingID INT IDENTITY(1,1) PRIMARY KEY,
    PcoRoomName NVARCHAR(255) NOT NULL,
    DoorID INT NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (DoorID) REFERENCES Doors(DoorID),
    INDEX IX_PcoRoomName (PcoRoomName)
);

-- Example data
INSERT INTO RoomDoorMappings (PcoRoomName, DoorID) VALUES
('FBC Sanctuary', 1),
('FBC Sanctuary', 2),
('FBC Sanctuary', 3),
('SC 100', 101),
('SC 100', 102);
```

**Entity Model:**
```csharp
public class RoomDoorMapping
{
    public int MappingID { get; set; }
    public string PcoRoomName { get; set; } = string.Empty;
    public int DoorID { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Door Door { get; set; } = null!;
}
```

**Service:**
```csharp
public class RoomMappingService
{
    private readonly DoorControlDbContext _context;
    private readonly IMemoryCache _cache;

    public async Task<List<int>> GetDoorIdsForRoomAsync(string pcoRoomName)
    {
        // Check cache first (5 minute expiry)
        var cacheKey = $"room_mapping:{pcoRoomName}";
        if (_cache.TryGetValue<List<int>>(cacheKey, out var cached))
            return cached;

        // Query database
        var doorIds = await _context.RoomDoorMappings
            .Where(m => m.IsActive && m.PcoRoomName == pcoRoomName)
            .Select(m => m.DoorID)
            .ToListAsync();

        // Cache result
        _cache.Set(cacheKey, doorIds, TimeSpan.FromMinutes(5));

        return doorIds;
    }
}
```

### Phase 3C: Q&A Answer Parsing (Advanced)

Parse PCO resource request answers for specific door instructions:

**Example Q&A:**
- Question: "Which doors need unlocking?"
- Answer: "Main entrance, Student Center entrance"

**Parser:**
```csharp
public class AnswerParser
{
    public List<int> ParseDoorIdsFromAnswer(string question, string answer)
    {
        var doorIds = new List<int>();

        // Question contains "door" or "entrance"
        if (!question.Contains("door", StringComparison.OrdinalIgnoreCase) &&
            !question.Contains("entrance", StringComparison.OrdinalIgnoreCase))
            return doorIds;

        // Parse answer for known door names
        var lowerAnswer = answer.ToLower();

        if (lowerAnswer.Contains("main entrance"))
            doorIds.Add(1);
        
        if (lowerAnswer.Contains("student center"))
            doorIds.AddRange(new[] { 100, 101, 102 });
        
        if (lowerAnswer.Contains("sanctuary"))
            doorIds.AddRange(new[] { 1, 2, 3 });

        // TODO: More sophisticated NLP parsing

        return doorIds;
    }
}
```

**Recommendation:** Start with Phase 3A (hardcoded), migrate to Phase 3B (database) once stable.

---

## Sync Strategies

### Strategy Comparison

| Strategy | Latency | Complexity | Reliability | Recommendation |
|----------|---------|------------|-------------|----------------|
| **Periodic Polling (Cron)** | 5-15 min | Low | High | ✅ **Start Here** |
| **Webhooks (Push)** | <1 min | Medium | Medium | Phase 3B |
| **Hybrid (Webhook + Fallback)** | <1 min | High | Highest | Phase 3C |

### Phase 3A: Periodic Polling (Recommended)

**Pros:**
- Simple to implement
- No webhook infrastructure needed
- Reliable (no missed events)
- Easy to test and debug

**Cons:**
- Higher latency (5-15 minutes)
- More API calls (every sync hits PCO)

**Implementation:**

```csharp
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FBCADoorControl.Services;

public class PcoSyncService : BackgroundService
{
    private readonly IPcoApiClient _pcoClient;
    private readonly IPcoEventProcessor _eventProcessor;
    private readonly ILogger<PcoSyncService> _logger;
    private readonly PcoOptions _options;

    public PcoSyncService(
        IPcoApiClient pcoClient,
        IPcoEventProcessor eventProcessor,
        IOptions<PcoOptions> options,
        ILogger<PcoSyncService> logger)
    {
        _pcoClient = pcoClient;
        _eventProcessor = eventProcessor;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PCO Sync Service starting. Interval: {Interval} minutes", 
            _options.SyncIntervalMinutes);

        // Wait 1 minute before first sync (let other services start)
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(_options.SyncIntervalMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncEventsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PCO sync failed");
            }

            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("PCO Sync Service stopped");
    }

    private async Task SyncEventsAsync(CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;
        _logger.LogInformation("Starting PCO sync at {Time}", startTime);

        // Fetch events for next N days
        var windowStart = DateTime.Now;
        var windowEnd = windowStart.AddDays(_options.SyncWindowDays);

        var instances = await _pcoClient.GetEventInstancesAsync(
            windowStart, windowEnd, _options.MaxEventsPerSync);

        _logger.LogInformation("Fetched {Count} event instances from PCO", instances.Count);

        // Filter approved events only
        var approvedEvents = instances.Where(e => e.ApprovalStatus == "A").ToList();
        _logger.LogInformation("Processing {Count} approved events", approvedEvents.Count);

        // Process each event
        int created = 0, updated = 0, skipped = 0;

        foreach (var eventInstance in approvedEvents)
        {
            if (cancellationToken.IsCancellationRequested)
                break;

            try
            {
                var result = await _eventProcessor.ProcessEventAsync(eventInstance);
                
                switch (result.Status)
                {
                    case ProcessStatus.Created:
                        created++;
                        break;
                    case ProcessStatus.Updated:
                        updated++;
                        break;
                    case ProcessStatus.Skipped:
                        skipped++;
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process event {EventId}", eventInstance.EventId);
            }
        }

        var duration = DateTime.UtcNow - startTime;
        _logger.LogInformation(
            "PCO sync completed in {Duration}. Created: {Created}, Updated: {Updated}, Skipped: {Skipped}",
            duration, created, updated, skipped);
    }
}
```

### Phase 3B: Webhooks (Future)

**PCO Webhook Configuration:**
1. Go to PCO Developer Console
2. Register webhook URL: `https://yourdomain.com/api/webhooks/pco`
3. Subscribe to events:
   - `calendar.event.created`
   - `calendar.event.updated`
   - `calendar.event.deleted`
   - `calendar.event_resource_request.approved`
   - `calendar.event_resource_request.declined`

**Webhook Endpoint:**
```csharp
[ApiController]
[Route("api/webhooks")]
public class PcoWebhookController : ControllerBase
{
    private readonly IPcoEventProcessor _processor;
    private readonly ILogger<PcoWebhookController> _logger;

    [HttpPost("pco")]
    public async Task<IActionResult> ReceivePcoWebhook([FromBody] PcoWebhookPayload payload)
    {
        _logger.LogInformation("Received PCO webhook: {Event}", payload.Event);

        // Verify webhook signature (PCO uses HMAC)
        if (!VerifyWebhookSignature(Request, payload))
        {
            _logger.LogWarning("Invalid webhook signature");
            return Unauthorized();
        }

        // Process event asynchronously
        _ = Task.Run(async () =>
        {
            try
            {
                await _processor.ProcessWebhookAsync(payload);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process webhook");
            }
        });

        return Ok(new { status = "received" });
    }

    private bool VerifyWebhookSignature(HttpRequest request, PcoWebhookPayload payload)
    {
        // TODO: Implement PCO webhook signature verification
        // See: https://developer.planning.center/docs/#/overview/webhooks
        return true;
    }
}
```

**Recommendation:** Start with polling (Phase 3A). Add webhooks later if latency becomes a problem.

---

## Implementation Phases

### Phase 3A: Basic Sync (2 weeks)

**Goal:** Automatic schedule creation from PCO events (manual trigger).

**Features:**
- [ ] PCO API client with authentication
- [ ] Fetch approved events with room bookings
- [ ] Hardcoded room → door mapping
- [ ] Create UnlockSchedule records (Source = "PCO")
- [ ] Manual sync trigger via API endpoint
- [ ] Basic error logging

**API Endpoint:**
```csharp
[HttpPost("api/pco/sync")]
public async Task<IActionResult> TriggerSync([FromQuery] int windowDays = 14)
{
    var result = await _pcoSyncService.TriggerManualSyncAsync(windowDays);
    return Ok(result);
}
```

**Success Criteria:**
- Staff can click "Sync from PCO" button
- Approved events in next 14 days create schedules
- Schedules appear in FullCalendar UI
- Doors unlock/lock correctly

### Phase 3B: Automated Sync (1 week)

**Goal:** Background service runs every 15 minutes.

**Features:**
- [ ] Background HostedService (PeriodicTimer)
- [ ] Automatic sync every 15 minutes
- [ ] Sync health monitoring
- [ ] Event deduplication (don't create duplicate schedules)
- [ ] Update existing schedules if event changes

**Event Cache Table:**
```sql
CREATE TABLE PcoEventCache (
    CacheID INT IDENTITY(1,1) PRIMARY KEY,
    PcoEventId NVARCHAR(50) NOT NULL UNIQUE,
    PcoEventInstanceId NVARCHAR(50) NOT NULL,
    LastSyncedAt DATETIME2 NOT NULL,
    EventHash NVARCHAR(64), -- Hash of event data to detect changes
    ScheduleIds NVARCHAR(MAX), -- JSON array of created schedule IDs
    INDEX IX_LastSynced (LastSyncedAt)
);
```

**Success Criteria:**
- Sync runs automatically without intervention
- No duplicate schedules created
- Event updates propagate to schedules within 15 minutes

### Phase 3C: Advanced Features (2 weeks)

**Goal:** Webhook support, Q&A parsing, conflict detection.

**Features:**
- [ ] PCO webhook receiver
- [ ] Webhook signature verification
- [ ] Q&A answer parsing for door selection
- [ ] Database-driven room mapping (admin UI)
- [ ] Conflict detection (overlapping events)
- [ ] Priority assignment based on event type
- [ ] Bi-directional sync (write approval status back to PCO)

**Success Criteria:**
- Event changes sync within 1 minute (webhooks)
- Staff can configure room mappings via UI
- System detects and logs scheduling conflicts

---

## Error Handling & Edge Cases

### API Error Handling

```csharp
public async Task<List<PcoEventInstance>> GetEventInstancesAsync(...)
{
    try
    {
        var response = await _httpClient.GetAsync(url);
        
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            _logger.LogError("PCO API authentication failed. Check credentials.");
            throw new PcoApiException("Authentication failed");
        }
        
        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            var retryAfter = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromMinutes(1);
            _logger.LogWarning("PCO API rate limited. Retry after {Delay}", retryAfter);
            await Task.Delay(retryAfter);
            return await GetEventInstancesAsync(...); // Retry
        }
        
        response.EnsureSuccessStatusCode();
        // ... parse response
    }
    catch (HttpRequestException ex)
    {
        _logger.LogError(ex, "PCO API request failed");
        throw;
    }
    catch (JsonException ex)
    {
        _logger.LogError(ex, "Failed to parse PCO API response");
        throw;
    }
}
```

### Edge Cases

#### 1. Event with No Approved Rooms

**Scenario:** Event approved, but all room requests are pending/declined.

**Solution:** Skip event (don't create schedules). Log warning.

```csharp
var approvedRooms = resourceRequests
    .Where(r => r.ResourceKind == "Room" && r.ApprovalStatus == "A")
    .ToList();

if (!approvedRooms.Any())
{
    _logger.LogWarning("Event {EventId} has no approved rooms. Skipping.", eventId);
    return ProcessStatus.Skipped;
}
```

#### 2. Event Cancelled After Schedule Created

**Scenario:** Event synced, schedule created. Later, event is cancelled in PCO.

**Solution:** Periodic cleanup job that checks for deleted events.

```csharp
public async Task CleanupDeletedEventsAsync()
{
    // Get all PCO-sourced schedules
    var pcoSchedules = await _context.UnlockSchedules
        .Where(s => s.Source == "PCO" && s.StartTime > DateTime.UtcNow)
        .ToListAsync();

    foreach (var schedule in pcoSchedules)
    {
        // Extract PCO event ID from schedule name or cache
        var pcoEventId = ExtractPcoEventId(schedule);
        
        // Check if event still exists in PCO
        var pcoEvent = await _pcoClient.GetEventAsync(pcoEventId);
        
        if (pcoEvent == null || pcoEvent.ApprovalStatus == "D")
        {
            _logger.LogInformation("Event {EventId} cancelled. Deleting schedule {ScheduleId}",
                pcoEventId, schedule.ScheduleID);
            
            schedule.IsActive = false;
            schedule.UpdatedAt = DateTime.UtcNow;
        }
    }

    await _context.SaveChangesAsync();
}
```

#### 3. Room Name Not in Mapping

**Scenario:** PCO event uses room "New Conference Room" that's not in our mapping.

**Solution:** Log warning, send notification to admin, skip room.

```csharp
var doorIds = RoomDoorMapping.GetDoorIdsForRoom(roomName);

if (doorIds.Length == 0)
{
    _logger.LogWarning("No door mapping found for room: {RoomName}. Event: {EventName}",
        roomName, eventName);
    
    // Optional: Send notification to admin
    await _notificationService.NotifyAsync(
        "Missing room mapping",
        $"Room '{roomName}' in event '{eventName}' has no door mapping. Please configure.");
    
    continue; // Skip this room, process other rooms
}
```

#### 4. Overlapping Events (Same Door, Same Time)

**Scenario:** Two events book the same room at overlapping times.

**Solution:** Allow both schedules (use priority system for lock decisions).

```csharp
// This is OKAY - scheduler service handles priority
// Higher priority schedules prevent lower priority locks
// (This is already implemented in SchedulerService)
```

#### 5. Event Time Changed in PCO

**Scenario:** Event originally at 6 PM, changed to 7 PM in PCO.

**Solution:** Update existing schedules (don't create duplicates).

```csharp
public async Task<ProcessResult> ProcessEventAsync(PcoEventInstance instance)
{
    // Check if we've synced this event before
    var cache = await _context.PcoEventCache
        .FirstOrDefaultAsync(c => c.PcoEventInstanceId == instance.Id);

    if (cache != null)
    {
        // Check if event changed
        var newHash = ComputeEventHash(instance);
        if (cache.EventHash != newHash)
        {
            _logger.LogInformation("Event {EventId} changed. Updating schedules.", instance.EventId);
            
            // Delete old schedules
            var oldScheduleIds = JsonSerializer.Deserialize<List<int>>(cache.ScheduleIds);
            foreach (var scheduleId in oldScheduleIds)
            {
                var schedule = await _context.UnlockSchedules.FindAsync(scheduleId);
                if (schedule != null)
                {
                    schedule.IsActive = false;
                }
            }
            
            // Create new schedules
            var newScheduleIds = await CreateSchedulesForEventAsync(instance);
            
            // Update cache
            cache.EventHash = newHash;
            cache.LastSyncedAt = DateTime.UtcNow;
            cache.ScheduleIds = JsonSerializer.Serialize(newScheduleIds);
            
            await _context.SaveChangesAsync();
            
            return new ProcessResult { Status = ProcessStatus.Updated };
        }
    }
    else
    {
        // New event - create schedules
        var scheduleIds = await CreateSchedulesForEventAsync(instance);
        
        // Cache event
        _context.PcoEventCache.Add(new PcoEventCache
        {
            PcoEventId = instance.EventId,
            PcoEventInstanceId = instance.Id,
            EventHash = ComputeEventHash(instance),
            LastSyncedAt = DateTime.UtcNow,
            ScheduleIds = JsonSerializer.Serialize(scheduleIds)
        });
        
        await _context.SaveChangesAsync();
        
        return new ProcessResult { Status = ProcessStatus.Created };
    }
}
```

#### 6. PCO API Rate Limiting

**Scenario:** Hit PCO API rate limit during sync.

**Solution:** Exponential backoff, retry with delay.

```csharp
private async Task<T> FetchWithRetryAsync<T>(Func<Task<T>> fetchFunc, int maxRetries = 3)
{
    int attempt = 0;
    while (true)
    {
        try
        {
            return await fetchFunc();
        }
        catch (PcoRateLimitException ex) when (attempt < maxRetries)
        {
            attempt++;
            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt)); // 2s, 4s, 8s
            _logger.LogWarning("Rate limited. Retry {Attempt}/{Max} after {Delay}",
                attempt, maxRetries, delay);
            await Task.Delay(delay);
        }
    }
}
```

---

## Security & Authentication

### PCO API Credentials

**Storage:**
- Store in `appsettings.json` (dev) or environment variables (production)
- **NEVER commit credentials to Git**

```json
// appsettings.json (not committed)
{
  "PCO": {
    "AppId": "YOUR_PCO_APP_ID",
    "Secret": "YOUR_PCO_SECRET"
  }
}

// appsettings.Development.json (committed, placeholder)
{
  "PCO": {
    "AppId": "YOUR_APP_ID_HERE",
    "Secret": "YOUR_SECRET_HERE"
  }
}
```

**Environment Variables (Production):**
```bash
export PCO__AppId="your_app_id"
export PCO__Secret="your_secret"
```

### PCO Personal Access Token Setup

1. Go to: https://api.planningcenteronline.com/oauth/applications
2. Click "New Personal Access Token"
3. Name: "FBCA Door Control System"
4. Scopes: `calendar` (read access)
5. Copy App ID and Secret
6. Add to appsettings.json

**Testing Credentials:**
```bash
curl -u "APP_ID:SECRET" https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=1
```

### Webhook Security (Phase 3C)

**PCO Webhook Signature Verification:**

PCO signs webhooks with HMAC-SHA256. Verify signature before processing.

```csharp
private bool VerifyWebhookSignature(HttpRequest request)
{
    var signature = request.Headers["X-PCO-Signature"].FirstOrDefault();
    if (string.IsNullOrEmpty(signature))
        return false;

    var secret = _options.WebhookSecret;
    var body = await new StreamReader(request.Body).ReadToEndAsync();
    
    var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
    var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
    var expectedSignature = $"sha256={BitConverter.ToString(hash).Replace("-", "").ToLower()}";

    return signature == expectedSignature;
}
```

---

## Testing Strategy

### Unit Tests

**Test PCO API Client:**
```csharp
[Fact]
public async Task GetEventInstancesAsync_ReturnsApprovedEvents()
{
    // Arrange
    var mockHttp = new MockHttpMessageHandler();
    mockHttp.When("*/event_instances*")
        .Respond("application/json", SamplePcoResponse);
    
    var client = new PcoApiClient(mockHttp.ToHttpClient(), _options, _logger);
    
    // Act
    var instances = await client.GetEventInstancesAsync(DateTime.Now, DateTime.Now.AddDays(7));
    
    // Assert
    Assert.NotEmpty(instances);
    Assert.All(instances, i => Assert.Equal("A", i.ApprovalStatus));
}
```

**Test Room Mapping:**
```csharp
[Theory]
[InlineData("FBC Sanctuary", new[] { 1, 2, 3 })]
[InlineData("SC 100", new[] { 101, 102 })]
[InlineData("Unknown Room", new int[0])]
public void GetDoorIdsForRoom_ReturnsCorrectMapping(string roomName, int[] expectedDoorIds)
{
    var doorIds = RoomDoorMapping.GetDoorIdsForRoom(roomName);
    Assert.Equal(expectedDoorIds, doorIds);
}
```

### Integration Tests

**Test Full Sync Workflow:**
```csharp
[Fact]
public async Task SyncEventsAsync_CreatesSchedulesForApprovedEvents()
{
    // Arrange
    var pcoClient = new PcoApiClient(...); // Real API client
    var processor = new PcoEventProcessor(_context, _logger);
    
    // Act
    var instances = await pcoClient.GetEventInstancesAsync(DateTime.Now, DateTime.Now.AddDays(1));
    var results = new List<ProcessResult>();
    
    foreach (var instance in instances)
    {
        var result = await processor.ProcessEventAsync(instance);
        results.Add(result);
    }
    
    // Assert
    Assert.NotEmpty(results);
    
    var schedules = await _context.UnlockSchedules
        .Where(s => s.Source == "PCO")
        .ToListAsync();
    
    Assert.NotEmpty(schedules);
}
```

### Manual Testing Checklist

- [ ] PCO API credentials work (test connection)
- [ ] Fetch events for next 14 days
- [ ] Filter approved events only
- [ ] Rooms map to correct doors
- [ ] Schedules created with correct times
- [ ] Schedules appear in FullCalendar UI
- [ ] Doors unlock/lock at scheduled times
- [ ] Duplicate events don't create duplicate schedules
- [ ] Event time changes update existing schedules
- [ ] Cancelled events remove schedules

---

## Monitoring & Observability

### Logging

**Key Events to Log:**

| Level | Event | Example |
|-------|-------|---------|
| Information | Sync started/completed | "PCO sync completed. Created: 5, Updated: 2" |
| Warning | Missing room mapping | "Room 'New Chapel' has no door mapping" |
| Warning | Rate limit hit | "PCO API rate limited. Retrying in 5s" |
| Error | API failure | "PCO API request failed: 500 Internal Server Error" |
| Error | Schedule creation failed | "Failed to create schedule for event 12345" |

**Structured Logging:**
```csharp
_logger.LogInformation(
    "PCO sync completed. Duration: {Duration}ms, Created: {Created}, Updated: {Updated}, Errors: {Errors}",
    duration, createdCount, updatedCount, errorCount);
```

### Health Checks

**PCO API Health Check:**
```csharp
public class PcoHealthCheck : IHealthCheck
{
    private readonly IPcoApiClient _pcoClient;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct)
    {
        try
        {
            var isConnected = await _pcoClient.TestConnectionAsync();
            
            if (isConnected)
                return HealthCheckResult.Healthy("PCO API is reachable");
            else
                return HealthCheckResult.Degraded("PCO API connection test failed");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("PCO API is unreachable", ex);
        }
    }
}

// Register in Program.cs
builder.Services.AddHealthChecks()
    .AddCheck<PcoHealthCheck>("pco_api");
```

### Metrics

**Track These Metrics:**
- Total events synced (counter)
- Schedules created per sync (gauge)
- Sync duration (histogram)
- API errors (counter)
- Missing room mappings (counter)

**Example (using Application Insights):**
```csharp
_telemetry.TrackMetric("pco.sync.events_created", createdCount);
_telemetry.TrackMetric("pco.sync.duration_ms", durationMs);
```

---

## Questions & Gaps

### Questions for Billy

1. **PCO API Access:**
   - [ ] Do we have PCO API credentials? (Personal Access Token)
   - [ ] What permission level? (Need read access to Calendar API)

2. **Room Mapping:**
   - [ ] Can Billy provide complete list of PCO room names?
   - [ ] Can Billy provide mapping of rooms → door IDs?
   - [ ] Are there any rooms that should NOT trigger door unlocks?

3. **Business Logic:**
   - [ ] Should we add buffer time (unlock 30 min early)? Or trust PCO booking times?
   - [ ] What priority should PCO events have? (Default 5 or higher?)
   - [ ] Should worship services get higher priority than meetings?
   - [ ] What happens if event is cancelled in PCO? Delete schedule immediately or wait?

4. **Approval Workflow:**
   - [ ] Only sync events where event AND all rooms are approved? Or partial approval okay?
   - [ ] Should we check "Building Access" resource approval specifically?

5. **Sync Frequency:**
   - [ ] Is 15-minute sync acceptable? Or need faster (webhooks)?
   - [ ] How far ahead should we sync? (14 days? 30 days?)

6. **Error Handling:**
   - [ ] Who should be notified when sync fails? (Email? Slack?)
   - [ ] What's acceptable failure rate? (1% of events? 5%?)

7. **Testing:**
   - [ ] Can we test against PCO staging environment? Or use production carefully?
   - [ ] Any test events we can use for validation?

### Known Gaps

1. **Database Migration:**
   - Need to add `PcoEventCache` table for deduplication
   - Need to add `RoomDoorMappings` table (Phase 3B)

2. **Configuration:**
   - Need to map ALL FBCA rooms to door IDs (only have examples so far)

3. **Edge Cases:**
   - How to handle recurring events? (PCO has RRULE support)
   - What if event spans multiple days? (e.g., weekend retreat)

4. **Performance:**
   - What if FBCA has 500+ events in next 14 days? (Batch processing? Pagination?)

5. **Monitoring:**
   - Need dashboard for sync health
   - Need alerts for repeated failures

---

## Next Steps

### Immediate (Before Coding)

1. **Get PCO API Access:**
   - [ ] Billy creates Personal Access Token at https://api.planningcenteronline.com/oauth/applications
   - [ ] Billy provides App ID + Secret
   - [ ] Test credentials with curl or Postman

2. **Document Room Mappings:**
   - [ ] Billy exports list of all rooms from PCO
   - [ ] Billy provides mapping: PCO room name → Door IDs
   - [ ] Create `RoomMappingConfig.cs` with hardcoded dictionary

3. **Review Business Logic:**
   - [ ] Billy answers questions above
   - [ ] Document decisions in PROJECT_SPEC.md

### Phase 3A Implementation (Week 1-2)

**Day 1-2: API Client**
- [ ] Create `PcoOptions` configuration class
- [ ] Create `IPcoApiClient` interface + implementation
- [ ] Create PCO data models (PcoEventInstance, PcoEvent, etc.)
- [ ] Write unit tests for API client (with mocked HTTP)
- [ ] Test against real PCO API

**Day 3-4: Event Processing**
- [ ] Create `IPcoEventProcessor` interface
- [ ] Implement room mapping logic
- [ ] Implement schedule creation logic
- [ ] Add deduplication (check existing schedules)
- [ ] Write integration tests

**Day 5-6: Manual Sync Endpoint**
- [ ] Create `/api/pco/sync` endpoint
- [ ] Add UI button in FullCalendar ("Sync from PCO")
- [ ] Test end-to-end (PCO → UI → Doors)

**Day 7: Testing & Refinement**
- [ ] Test with real PCO events
- [ ] Fix bugs
- [ ] Add error logging
- [ ] Document API endpoints

### Phase 3B Implementation (Week 3)

**Day 1-2: Background Service**
- [ ] Create `PcoSyncService` (IHostedService)
- [ ] Add PeriodicTimer (15-minute interval)
- [ ] Register service in Program.cs
- [ ] Test background sync

**Day 3-4: Event Caching**
- [ ] Create `PcoEventCache` database table
- [ ] Implement change detection (event hash)
- [ ] Update existing schedules on event change
- [ ] Delete schedules for cancelled events

**Day 5: Monitoring**
- [ ] Add PCO health check
- [ ] Add logging for all sync operations
- [ ] Create `/api/pco/status` endpoint (last sync time, error count)

### Phase 3C (Future - Optional)

- [ ] Implement PCO webhooks
- [ ] Q&A answer parsing
- [ ] Database-driven room mapping (admin UI)
- [ ] Bi-directional sync (write back to PCO)

---

## Appendix: FBCA PCO Configuration

### Known Approval Groups

```csharp
public static class FbcaApprovalGroups
{
    public const string BUILDING_ACCESS = "139176";
    public const string IT_EQUIPMENT = "139181";
    public const string ROOM_SETUP = "139184";
    public const string ROOMS = "139185";
}
```

### Known Room Names (Sample)

```csharp
public static class FbcaRoomNames
{
    public const string FBC_SANCTUARY = "FBC Sanctuary";
    public const string FBC_WELCOME_EAST = "FBC Welcome Center - East Commons";
    public const string FBC_WELCOME_SOUTH = "FBC Welcome Center - South Commons";
    public const string SC_100 = "SC 100";
    public const string SC_101 = "SC 101";
    public const string SC_LOBBY = "SC Lobby";
    public const string WADE_CONF_ROOM = "Wade Building - Conference Room";
    public const string GYM_MAIN = "Gym - Main";
}
```

### Sample Room → Door Mapping

```csharp
// This is INCOMPLETE - Billy needs to provide full mapping
private static readonly Dictionary<string, int[]> RoomDoorMap = new()
{
    { FbcaRoomNames.FBC_SANCTUARY, new[] { 1, 2, 3 } },
    { FbcaRoomNames.SC_100, new[] { 101, 102 } },
    { FbcaRoomNames.SC_101, new[] { 103 } },
    { FbcaRoomNames.SC_LOBBY, new[] { 100, 104 } },
    { FbcaRoomNames.WADE_CONF_ROOM, new[] { 201 } },
    { FbcaRoomNames.GYM_MAIN, new[] { 300, 301, 302 } },
    // TODO: Add remaining 52 doors
};
```

---

## Summary

This integration plan provides:

✅ **Complete PCO Calendar API understanding** (events, rooms, resources, approvals)  
✅ **C# code samples** ready to implement (API client, data models, services)  
✅ **Room-to-door mapping strategy** (hardcoded → database → Q&A parsing)  
✅ **Sync strategies** (polling vs webhooks, with recommendations)  
✅ **Phased implementation plan** (3A → 3B → 3C)  
✅ **Error handling & edge cases** (rate limits, missing mappings, cancelled events)  
✅ **Testing strategy** (unit, integration, manual)  
✅ **Monitoring & observability** (logging, health checks, metrics)

**Next Action:** Billy reviews this plan, answers questions, and provides PCO API credentials + room mappings.

---

**Document Status:** ✅ Complete - Ready for Billy's review  
**Last Updated:** February 13, 2026 12:48 AM CST  
**Author:** OpenClaw Subagent (PCO API Expert)
