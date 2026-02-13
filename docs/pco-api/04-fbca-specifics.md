# FBCA-Specific Configuration

Configuration and patterns specific to First Baptist Church Arlington's PCO setup.

## Architecture Overview

```
PCO Calendar API (source of truth)
    ↓
Vercel Middleware (pco-webhook.vercel.app/api/cron/pco-sync)
    ↓
Base44 Campus Hub (ingestion + UI)
```

### Current Middleware
- **URL:** `https://pco-webhook.vercel.app/api/cron/pco-sync`
- **Runtime:** Vercel Node.js serverless (ESM — `.mjs`)
- **Version:** r18 (as of Jan 2026)

### Base44 Apps
- **Event Ops Dashboard** — 14-day view with room-level checklists
- **My Approvals App** — User-specific approval queue filtered by approval group membership

## FBCA Approval Groups

These are the known approval groups configured in PCO Calendar:

| Group ID | Group Name | Purpose |
|----------|------------|---------|
| 139176 | Building Access | Controls building/door access approvals |
| 139181 | IT Equipment | AV equipment, projectors, tech needs |
| 139184 | Room Setup | Furniture/setup configuration |
| 139185 | Rooms | Room reservation approvals |

## FBCA Known Rooms

Examples of rooms in the system:
- `SC 100` — Student Center room 100
- `FBC Sanctuary` — Main sanctuary
- `FBC Welcome Center - East Commons`
- `FBC Welcome Center - South Commons`

## Data Shape: Event Object

The standardized event shape used between middleware and Base44:

```json
{
  "eventid": "pco:19081356",
  "pco_event_id": "19081356",
  "name": "FBCA College Thursdays",
  "starts_at": "2026-01-16T00:30:00Z",
  "ends_at": "2026-01-16T03:00:00Z",
  "approval_status": "A",
  "rooms": [
    {
      "pco_resource_id": "723185",
      "pco_booking_id": "346289389",
      "pco_resource_request_id": "31970985",
      "name": "SC 100",
      "kind": "Room",
      "quantity": 1,
      "starts_at": "2026-01-16T00:30:00Z",
      "ends_at": "2026-01-16T03:00:00Z",
      "approval_status": "A",
      "approval_sent": true,
      "approval_groups": [
        { "id": "139185", "name": "Rooms" }
      ],
      "answers": []
    }
  ],
  "resources": [
    {
      "pco_resource_id": "724356",
      "pco_booking_id": "346289440",
      "pco_resource_request_id": "31970988",
      "name": "Building Access",
      "kind": "Resource",
      "quantity": 1,
      "approval_status": "A",
      "approval_groups": [
        { "id": "139176", "name": "Building Access" }
      ],
      "answers": []
    }
  ]
}
```

**Important notes:**
- `eventid` uses `pco:` prefix to avoid Base44 validation errors on numeric IDs
- `rooms` and `resources` are separated by `kind` field
- `approval_groups` is always an array (even if only one group)
- `answers` array may be empty — only populated when Q&A data is fetched

## Approval Status Codes

| Code | Meaning | Display |
|------|---------|---------|
| `A` | Approved | ✅ |
| `P` | Pending | ⏳ |
| `D` | Declined | ❌ |

## User-Specific Approval Filtering

Users should only see approvals for groups they belong to:

```javascript
// 1. Get user's groups
const userGroups = await fetch(
  `${middlewareUrl}?userGroups=1&email=${userEmail}`
).then(r => r.json());

// 2. Filter approvals by group membership
const myApprovals = allApprovals.filter(approval =>
  approval.approvalGroups?.some(group =>
    userGroups.approvalGroupNames.includes(group.name)
  )
);
```

## Middleware Endpoints Quick Reference

| Endpoint | Purpose |
|----------|---------|
| `?health=1` | Health check + env validation |
| `?debug=1&windowDays=14&maxEvents=10` | Debug mode (no ingest) |
| `?debugEvent=1&eventId=19081356` | Single event details |
| `?backfill=1&windowDays=14&maxEvents=5&offset=0` | Backfill to Base44 (lean mode) |
| `?approvals=1&windowDays=30&maxEvents=100` | Get pending approvals |
| `?approve=1&resourceRequestId=31477885` | Approve a resource request |
| `?userGroups=1&email=billy.nelms@fbca.org` | Get user's approval groups |
| `?probe=1&eventId=X` | API discovery mode |

## Known Issues & Gotchas

1. **Duplicate rooms/resources** — PCO sometimes returns duplicates; always deduplicate by `pco_resource_id`
2. **504 timeouts** — Large syncs can exceed Vercel's timeout; use lean mode and batching
3. **Dropdown answer format** — Dropdown answers are prefixed with `|` (e.g., `"|Doors Unlocked"`); strip the leading pipe
4. **Event vs Event Instance** — An "event" is the template; "event instances" are the actual occurrences with dates
5. **Approval group membership** — No single endpoint returns "which groups is person X in"; you must cross-reference People API + approval group people lists
6. **CORS required** — Base44 frontend calls need CORS headers on every response including OPTIONS
