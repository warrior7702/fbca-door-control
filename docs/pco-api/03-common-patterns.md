# Common PCO API Patterns

## Pagination

PCO uses offset-based pagination. Every list endpoint supports:

```
?per_page=25&offset=0
```

- `per_page` — Max 100, default 25
- `offset` — Skip this many records

**Pagination loop pattern:**
```javascript
async function paginateAll(baseUrl) {
  let results = [];
  let offset = 0;
  const perPage = 100;
  
  while (true) {
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}per_page=${perPage}&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: pcoAuth() } });
    const data = await res.json();
    
    results = results.concat(data.data || []);
    
    // Check for next page
    if (!data.links?.next || (data.data || []).length < perPage) break;
    offset += perPage;
  }
  
  return results;
}
```

**Check total count without fetching all:**
```
GET /people/v2/people?per_page=1
```
Response `meta.total_count` tells you how many records exist.

## Includes (Sideloading)

Reduce API calls by including related resources:

```
GET /calendar/v2/events/{id}/event_resource_requests?include=resource,resource_approval_group
```

Multiple includes are comma-separated. Included resources appear in the `included` array.

**Resolving includes:**
```javascript
function resolveInclude(data, type, id) {
  return data.included?.find(inc => inc.type === type && inc.id === id);
}

// Usage:
const resource = resolveInclude(responseData, 'Resource', rr.relationships.resource.data.id);
```

## Filtering

### Where clauses
```
?where[attribute]=value
```

Examples:
```
?where[approval_status]=P          # Pending approvals only
?where[search_name]=John           # Name search
?where[starts_at][gte]=2026-01-01  # Date range (gte = greater than or equal)
?where[starts_at][lte]=2026-01-31  # Date range (lte = less than or equal)
```

### Predefined filters
```
?filter=future                     # Only future items
?filter=past                       # Only past items
```

Multiple filters: `?filter=future,approved`

## Ordering

```
?order=starts_at                   # Ascending
?order=-starts_at                  # Descending (prefix with -)
```

Multiple: `?order=last_name,first_name`

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process data |
| 201 | Created | Resource created successfully |
| 204 | No Content | Delete succeeded |
| 400 | Bad Request | Check your request body/params |
| 401 | Unauthorized | Check auth credentials |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist or wrong endpoint |
| 422 | Unprocessable | Validation error (check response body for details) |
| 429 | Rate Limited | Back off and retry |
| 500 | Server Error | PCO issue, retry later |

### Error response format:
```json
{
  "errors": [
    {
      "status": "422",
      "title": "Unprocessable Entity",
      "detail": "approval_status is not a valid value",
      "source": { "parameter": "approval_status" }
    }
  ]
}
```

### Robust fetch wrapper:
```javascript
async function pcoFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${PCO_BASE}${path}`;
  
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': pcoAuth(),
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5');
      console.warn(`Rate limited. Retrying in ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return pcoFetch(path, options); // Retry
    }
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`PCO API ${res.status}: ${JSON.stringify(error.errors || error)}`);
    }
    
    if (res.status === 204) return null; // No content (DELETE)
    return res.json();
    
  } catch (err) {
    console.error(`PCO fetch failed: ${path}`, err.message);
    throw err;
  }
}
```

## Date Handling

PCO uses ISO 8601 dates in UTC:
```
2026-01-14T15:00:00Z
```

**Common date utilities:**
```javascript
function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function todayISO() {
  return new Date().toISOString().split('T')[0]; // "2026-01-14"
}

function dateWindow(windowDays) {
  const now = new Date();
  return {
    start: now.toISOString(),
    end: new Date(now.getTime() + windowDays * 86400000).toISOString()
  };
}
```

## Deduplication

PCO sometimes returns duplicate room/resource entries. Always deduplicate:

```javascript
function deduplicateByKey(items, key = 'pco_resource_id') {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item[key])) return false;
    seen.add(item[key]);
    return true;
  });
}
```

## ID Formatting

When storing PCO IDs in external systems, prefix them to avoid conflicts:

```javascript
// PCO event ID → external format
const externalId = `pco:${pcoEventId}`;  // "pco:13367491"

// Extract PCO ID from external format
const pcoId = externalId.replace('pco:', '');
```

This avoids issues with systems that have their own ID formats (e.g., Base44 validation errors on pure numeric IDs).
