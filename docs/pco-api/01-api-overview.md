# PCO API Overview

## Base URL

All PCO API requests go to:
```
https://api.planningcenteronline.com/{product}/v2/{endpoint}
```

### Product Base URLs

| Product | Base URL |
|---------|----------|
| Calendar | `https://api.planningcenteronline.com/calendar/v2` |
| People | `https://api.planningcenteronline.com/people/v2` |
| Services | `https://api.planningcenteronline.com/services/v2` |
| Check-Ins | `https://api.planningcenteronline.com/check-ins/v2` |
| Giving | `https://api.planningcenteronline.com/giving/v2` |
| Groups | `https://api.planningcenteronline.com/groups/v2` |

## Authentication

### Personal Access Tokens (simplest — for your own data)

Get tokens at: https://api.planningcenteronline.com/oauth/applications

Use HTTP Basic Auth:
```javascript
const headers = {
  'Authorization': 'Basic ' + Buffer.from(`${APP_ID}:${SECRET}`).toString('base64'),
  'Content-Type': 'application/json'
};
```

Or as a header shorthand:
```javascript
const response = await fetch(url, {
  headers: {
    'Authorization': `Basic ${Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64')}`
  }
});
```

### OAuth 2 (for apps that act on behalf of other users)

Register your app at: https://api.planningcenteronline.com/oauth/applications

Standard OAuth 2 flow:
1. Redirect user to `https://api.planningcenteronline.com/oauth/authorize?client_id=X&redirect_uri=Y&response_type=code&scope=Z`
2. Exchange code for token at `POST /oauth/token`
3. Use `Authorization: Bearer {token}` header

### Environment Variables (recommended pattern)

```env
PCO_APP_ID=your_app_id
PCO_SECRET=your_secret
```

```javascript
function pcoAuth() {
  return 'Basic ' + Buffer.from(
    `${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`
  ).toString('base64');
}
```

## JSON:API Specification

PCO follows the JSON:API 1.0 spec. Every response has this structure:

```json
{
  "data": [
    {
      "type": "Event",
      "id": "13367491",
      "attributes": {
        "name": "Sunday Worship",
        "starts_at": "2026-01-14T15:00:00Z",
        "approval_status": "A"
      },
      "relationships": {
        "owner": {
          "data": { "type": "Person", "id": "47952068" }
        }
      },
      "links": {
        "self": "https://api.planningcenteronline.com/calendar/v2/events/13367491"
      }
    }
  ],
  "included": [],
  "meta": {
    "total_count": 150,
    "count": 25,
    "next": { "offset": 25 }
  },
  "links": {
    "self": "https://api.planningcenteronline.com/calendar/v2/events?offset=0",
    "next": "https://api.planningcenteronline.com/calendar/v2/events?offset=25"
  }
}
```

### Key JSON:API Conventions

- **Single resource**: `data` is an object
- **Collection**: `data` is an array
- **Relationships**: Reference other resources by type + id
- **Included**: Sideloaded related resources (when using `?include=`)
- **Links**: Pagination and self-reference URLs
- **Meta**: Count, total_count, pagination info

## HTTP Methods

| Method | Purpose | Example |
|--------|---------|---------|
| GET | Read data | `GET /calendar/v2/events` |
| POST | Create resource | `POST /calendar/v2/events` |
| PATCH | Update resource | `PATCH /calendar/v2/events/123` |
| DELETE | Remove resource | `DELETE /calendar/v2/events/123` |

## API Explorer

Interactive API browser: https://api.planningcenteronline.com/explorer

Read-only, great for discovering endpoints and data shapes.

## Rate Limits

PCO applies rate limits per application. If you hit them:
- You'll get a `429 Too Many Requests` response
- Back off and retry with exponential delay
- Batch requests where possible
- Use `?include=` to reduce total API calls

## Webhooks

PCO supports webhooks for real-time notifications:
- Configure in PCO settings per product
- Receive POST requests when data changes
- Payload follows JSON:API format
- Useful for real-time sync instead of polling
