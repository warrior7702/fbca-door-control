# PCO Calendar API Reference

The Calendar API manages events, rooms, resources, bookings, approvals, and event setup details.

## Base URL
```
https://api.planningcenteronline.com/calendar/v2
```

## Core Resources

### Events

**List events:**
```
GET /calendar/v2/events
```

**List events in a date window:**
```
GET /calendar/v2/events?filter=future&per_page=25
```

**Get event instances (occurrences with actual dates):**
```
GET /calendar/v2/events/{event_id}/event_instances
```

**Filter by date range:**
```
GET /calendar/v2/event_instances?filter=future&where[starts_at][gte]=2026-01-01&where[starts_at][lte]=2026-01-14&per_page=100
```

**Single event:**
```
GET /calendar/v2/events/{id}
```

**Event attributes:**
- `name` — Event title
- `description` — HTML description
- `approval_status` — `A` (Approved), `P` (Pending), `D` (Declined)
- `percent_approved` — 0-100 percentage
- `percent_rejected` — 0-100 percentage
- `visible_in_church_center` — Boolean
- `featured` — Boolean
- `image_url` — Event image
- `created_at`, `updated_at` — Timestamps

### Event Instances

Event instances are the actual date/time occurrences of an event.

```
GET /calendar/v2/event_instances?filter=future&per_page=100&order=starts_at
```

**Include event details:**
```
GET /calendar/v2/event_instances?include=event&filter=future&per_page=100
```

**Event instance attributes:**
- `starts_at` — ISO 8601 datetime
- `ends_at` — ISO 8601 datetime
- `all_day_event` — Boolean
- `recurrence` — Recurrence pattern info

### Rooms and Resources (via Event Resource Requests)

**IMPORTANT:** Rooms and resources are accessed through Event Resource Requests, not directly from events.

**Get resource bookings for an event:**
```
GET /calendar/v2/events/{event_id}/event_resource_requests
```

**Include resource details in the response:**
```
GET /calendar/v2/events/{event_id}/event_resource_requests?include=resource,resource_approval_group
```

This is the key endpoint for getting room/resource data with approval info.

**Event Resource Request attributes:**
- `approval_status` — `A`, `P`, `D` per room/resource
- `approval_sent` — Boolean
- `quantity` — Number requested
- `starts_at`, `ends_at` — Booking-specific times (may differ from event times)

**Resource attributes (via include):**
- `name` — "SC 100", "FBC Sanctuary", "Building Access", etc.
- `kind` — `"Room"` or `"Resource"`

**Resource Approval Group attributes (via include):**
- `name` — "Rooms", "Building Access", "Room Setup", "IT Equipment", etc.
- `id` — Group ID for filtering

### Resource Bookings

Alternative way to get bookings (room-centric instead of event-centric):

```
GET /calendar/v2/resources/{resource_id}/resource_bookings?filter=future
```

### Answers (Q&A for Resource Requests)

Each resource request can have Q&A answers (setup instructions, access needs, etc.):

```
GET /calendar/v2/event_resource_requests/{id}/answers?per_page=100
```

**Answer structure:**
```json
{
  "data": [
    {
      "type": "EventResourceAnswer",
      "id": "12345",
      "attributes": {
        "answer": "|Doors Unlocked",
        "question": {
          "question": "What type of access do you need?",
          "choices": "Doors Unlocked|Badge Access|Door Code",
          "kind": "dropdown",
          "resource_question_id": 289650
        }
      }
    }
  ]
}
```

**Answer types by `kind`:**
- `dropdown` — Pipe-delimited choices, answer prefixed with `|`
- `text` — Free text answer
- `number` — Numeric answer
- `checkbox` — Boolean

**Common Q&A examples:**
- Room Setup: "50 chairs (2 sets of 25 with center aisle)"
- Building Access: "Doors Unlocked", "Student Center entrance", "6-8 PM"
- AV Needs: "Projector", "Sound system", "2 wireless mics"

### Approval Groups

Get all approval groups:
```
GET /calendar/v2/resource_approval_groups
```

Get people who can approve for a group:
```
GET /calendar/v2/resource_approval_groups/{id}/people
```

**Finding a user's approval groups by email:**
1. Look up person by email in People API: `GET /people/v2/people?where[search_name_or_email]=email@example.com`
2. Get all approval groups: `GET /calendar/v2/resource_approval_groups`
3. For each group, check if person is in the group's people list

### Approving/Declining Resource Requests

**Approve a resource request:**
```
PATCH /calendar/v2/event_resource_requests/{id}
Content-Type: application/json

{
  "data": {
    "type": "EventResourceRequest",
    "id": "{id}",
    "attributes": {
      "approval_status": "A"
    }
  }
}
```

**Decline:**
```json
{
  "data": {
    "type": "EventResourceRequest",
    "id": "{id}",
    "attributes": {
      "approval_status": "D"
    }
  }
}
```

## Common Calendar API Patterns

### Fetch events with rooms and resources for a date window

```javascript
async function fetchEventsWithRooms(windowDays = 14, maxEvents = 50) {
  const now = new Date();
  const future = new Date(now.getTime() + windowDays * 86400000);
  
  // 1. Get event instances in the window
  let url = `${PCO_BASE}/calendar/v2/event_instances?` +
    `filter=future&per_page=${maxEvents}&order=starts_at&include=event`;
  
  const instancesRes = await fetch(url, { headers: { Authorization: pcoAuth() } });
  const instancesData = await instancesRes.json();
  
  // 2. For each event, fetch resource requests with includes
  const events = [];
  for (const instance of instancesData.data) {
    const eventId = instance.relationships.event.data.id;
    
    const rrUrl = `${PCO_BASE}/calendar/v2/events/${eventId}/event_resource_requests` +
      `?include=resource,resource_approval_group&per_page=100`;
    const rrRes = await fetch(rrUrl, { headers: { Authorization: pcoAuth() } });
    const rrData = await rrRes.json();
    
    // 3. Parse rooms vs resources
    const rooms = [];
    const resources = [];
    
    for (const rr of rrData.data) {
      const resource = rrData.included?.find(
        inc => inc.type === 'Resource' && inc.id === rr.relationships.resource?.data?.id
      );
      const approvalGroup = rrData.included?.find(
        inc => inc.type === 'ResourceApprovalGroup' && 
        inc.id === rr.relationships.resource_approval_group?.data?.id
      );
      
      const item = {
        pco_resource_id: resource?.id,
        pco_resource_request_id: rr.id,
        name: resource?.attributes?.name || 'Unknown',
        kind: resource?.attributes?.kind || 'Unknown',
        quantity: rr.attributes.quantity,
        starts_at: rr.attributes.starts_at,
        ends_at: rr.attributes.ends_at,
        approval_status: rr.attributes.approval_status,
        approval_sent: rr.attributes.approval_sent,
        approval_groups: approvalGroup ? [{ id: approvalGroup.id, name: approvalGroup.attributes.name }] : []
      };
      
      if (resource?.attributes?.kind === 'Room') {
        rooms.push(item);
      } else {
        resources.push(item);
      }
    }
    
    events.push({
      eventid: `pco:${eventId}`,
      pco_event_id: eventId,
      name: instance.attributes.name || instancesData.included?.find(e => e.id === eventId)?.attributes?.name,
      starts_at: instance.attributes.starts_at,
      ends_at: instance.attributes.ends_at,
      rooms,
      resources
    });
  }
  
  return events;
}
```

### Fetch answers for a resource request

```javascript
async function fetchAnswers(resourceRequestId) {
  const url = `${PCO_BASE}/calendar/v2/event_resource_requests/${resourceRequestId}/answers?per_page=100`;
  const res = await fetch(url, { headers: { Authorization: pcoAuth() } });
  const data = await res.json();
  
  return (data.data || []).map(a => ({
    question: a.attributes.question?.question || 'Unknown',
    answer: (a.attributes.answer || '').replace(/^\|/, ''), // Strip leading pipe from dropdown answers
    kind: a.attributes.question?.kind || 'text',
    choices: a.attributes.question?.choices || '',
    question_id: a.attributes.question?.resource_question_id
  }));
}
```

### Approve a resource request

```javascript
async function approveResourceRequest(resourceRequestId) {
  const url = `${PCO_BASE}/calendar/v2/event_resource_requests/${resourceRequestId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': pcoAuth(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        type: 'EventResourceRequest',
        id: String(resourceRequestId),
        attributes: { approval_status: 'A' }
      }
    })
  });
  return res.json();
}
```
