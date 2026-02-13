# PCO Middleware Patterns

Patterns for building serverless middleware that syncs PCO data to external systems.

## Vercel Serverless Architecture

### Basic structure (single file API route)

```
project/
├── api/
│   └── cron/
│       └── pco-sync.mjs    # Main sync endpoint
├── .env.local               # Local env vars
├── vercel.json              # Vercel config
└── package.json
```

### vercel.json for cron scheduling

```json
{
  "crons": [
    {
      "path": "/api/cron/pco-sync?backfill=1&windowDays=14&maxEvents=50",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### Multi-mode endpoint pattern

A single endpoint that handles multiple operations via query params:

```javascript
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-eventops-secret');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { 
    health, debug, backfill, approvals, approve, 
    userGroups, probe, debugEvent,
    windowDays = '14', maxEvents = '50', offset = '0',
    eventId, resourceRequestId, email 
  } = req.query;
  
  try {
    // Health check
    if (health) {
      return res.json({
        version: 'r18',
        status: 'ok',
        env: {
          hasPcoAppId: !!process.env.PCO_APP_ID,
          hasPcoSecret: !!process.env.PCO_SECRET,
          hasWebhookUrl: !!process.env.BASE44_WEBHOOK_URL
        }
      });
    }
    
    // Debug mode (returns parsed data, doesn't ingest)
    if (debug) {
      const events = await fetchEvents(parseInt(windowDays), parseInt(maxEvents));
      return res.json({ version: 'r18', mode: 'debug', count: events.length, events });
    }
    
    // Backfill mode (fetches and ingests)
    if (backfill) {
      const events = await fetchEvents(parseInt(windowDays), parseInt(maxEvents));
      const result = await ingestToExternal(events);
      return res.json({ version: 'r18', mode: 'backfill', count: events.length, result });
    }
    
    // Approvals mode
    if (approvals) {
      const pending = await fetchPendingApprovals(parseInt(windowDays), parseInt(maxEvents));
      return res.json({ version: 'r18', mode: 'approvals', count: pending.length, approvals: pending });
    }
    
    // Approve action
    if (approve && resourceRequestId) {
      const result = await approveResourceRequest(resourceRequestId);
      return res.json({ version: 'r18', mode: 'approve', resourceRequestId, result });
    }
    
    // User groups lookup
    if (userGroups && email) {
      const groups = await getUserApprovalGroups(email);
      return res.json({ version: 'r18', mode: 'userGroups', ...groups });
    }
    
    return res.status(400).json({ error: 'No valid mode specified' });
    
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
```

## Avoiding Vercel 504 Timeouts

Vercel serverless functions have execution time limits (10s on Hobby, 60s on Pro). For large data syncs:

### Lean mode pattern
Strip unnecessary data before sending to external systems:

```javascript
function leanEvent(event) {
  return {
    eventid: event.eventid,
    pco_event_id: event.pco_event_id,
    name: event.name,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    approval_status: event.approval_status,
    rooms: event.rooms.map(r => ({
      pco_resource_id: r.pco_resource_id,
      name: r.name,
      approval_status: r.approval_status,
      approval_groups: r.approval_groups
    })),
    resources: event.resources.map(r => ({
      pco_resource_id: r.pco_resource_id,
      name: r.name,
      approval_status: r.approval_status,
      approval_groups: r.approval_groups
    }))
  };
}
```

### Offset-based batching
Process events in batches using the `offset` query param:

```javascript
if (backfill) {
  const events = await fetchEvents(parseInt(windowDays), parseInt(maxEvents), parseInt(offset));
  // Only process a batch, client can call again with offset+maxEvents
}
```

### Parallel fetch with concurrency limit

```javascript
async function fetchWithConcurrency(urls, limit = 5) {
  const results = [];
  for (let i = 0; i < urls.length; i += limit) {
    const batch = urls.slice(i, i + limit);
    const batchResults = await Promise.all(
      batch.map(url => fetch(url, { headers: { Authorization: pcoAuth() } }).then(r => r.json()))
    );
    results.push(...batchResults);
  }
  return results;
}
```

## Webhook Ingestion to External Systems

### Generic webhook push pattern

```javascript
async function ingestToExternal(events, webhookUrl = process.env.WEBHOOK_URL) {
  const results = [];
  
  for (const event of events) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eventops-secret': process.env.WEBHOOK_SECRET || ''
        },
        body: JSON.stringify(leanEvent(event))
      });
      results.push({ eventId: event.pco_event_id, status: res.status });
    } catch (err) {
      results.push({ eventId: event.pco_event_id, error: err.message });
    }
  }
  
  return results;
}
```

## Environment Variables

Standard env vars for a PCO middleware:

```env
# PCO Authentication
PCO_APP_ID=your_app_id
PCO_SECRET=your_secret

# External system webhook
BASE44_WEBHOOK_URL=https://your-system.com/webhook
WEBHOOK_SECRET=optional_shared_secret

# Optional
VERCEL_CRON_SECRET=your_cron_secret     # Protect cron endpoint
```

## CORS Configuration

Required when calling middleware from browser-based apps:

```javascript
// At the top of every handler
res.setHeader('Access-Control-Allow-Origin', '*');  // Or specific origin
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-eventops-secret');

if (req.method === 'OPTIONS') {
  return res.status(200).end();
}
```

## Probe/Discovery Mode

When exploring new PCO API endpoints, include a probe mode for safe experimentation:

```javascript
if (probe && eventId) {
  const event = await pcoFetch(`/calendar/v2/events/${eventId}`);
  
  // Discover available relationships
  const links = event.data?.links || {};
  const relationships = event.data?.relationships || {};
  
  return res.json({
    mode: 'probe',
    eventId,
    availableLinks: Object.keys(links),
    relationships: Object.keys(relationships),
    attributes: Object.keys(event.data?.attributes || {}),
    raw: event
  });
}
```

This is invaluable for discovering what data is available before building full integrations.
