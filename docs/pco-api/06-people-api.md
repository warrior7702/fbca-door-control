# PCO People API Reference

The People API manages contacts, members, lists, workflows, emails, phone numbers, and addresses.

## Base URL
```
https://api.planningcenteronline.com/people/v2
```

## Core Resources

### People

**List people:**
```
GET /people/v2/people?per_page=25&order=last_name
```

**Search by name or email:**
```
GET /people/v2/people?where[search_name_or_email]=john@example.com
```

**Search by name only:**
```
GET /people/v2/people?where[search_name]=John Smith
```

**Get single person:**
```
GET /people/v2/people/{id}
```

**Include related data:**
```
GET /people/v2/people?include=emails,phone_numbers,addresses&per_page=25
```

**Person attributes:**
- `first_name`, `last_name`, `middle_name`
- `nickname`
- `gender` — `M`, `F`, or blank
- `birthdate` — Date string
- `anniversary` — Date string
- `membership` — Membership status
- `status` — Active status
- `avatar` — Profile image URL
- `created_at`, `updated_at`

### Emails

```
GET /people/v2/people/{id}/emails
```

**Email attributes:**
- `address` — The email address
- `location` — `Home`, `Work`, etc.
- `primary` — Boolean

### Phone Numbers

```
GET /people/v2/people/{id}/phone_numbers
```

### Addresses

```
GET /people/v2/people/{id}/addresses
```

### Lists

Lists are saved queries/groups of people.

```
GET /people/v2/lists
GET /people/v2/lists/{id}/people
```

### Workflows

Workflows automate processes for people (e.g., new member onboarding).

```
GET /people/v2/workflows
GET /people/v2/workflows/{id}/steps
GET /people/v2/workflows/{id}/cards
```

## Common People API Patterns

### Look up person by email

```javascript
async function findPersonByEmail(email) {
  const url = `${PCO_BASE}/people/v2/people?where[search_name_or_email]=${encodeURIComponent(email)}&include=emails`;
  const res = await fetch(url, { headers: { Authorization: pcoAuth() } });
  const data = await res.json();
  
  // Find exact email match (search is fuzzy)
  const match = data.data?.find(person => {
    const emails = data.included?.filter(
      inc => inc.type === 'Email' && 
      inc.relationships?.person?.data?.id === person.id
    );
    return emails?.some(e => e.attributes.address.toLowerCase() === email.toLowerCase());
  });
  
  return match ? {
    id: match.id,
    name: `${match.attributes.first_name} ${match.attributes.last_name}`,
    email: email
  } : null;
}
```

### Bulk fetch people with pagination

```javascript
async function getAllPeople() {
  let allPeople = [];
  let offset = 0;
  const perPage = 100;
  
  while (true) {
    const url = `${PCO_BASE}/people/v2/people?per_page=${perPage}&offset=${offset}&include=emails`;
    const res = await fetch(url, { headers: { Authorization: pcoAuth() } });
    const data = await res.json();
    
    allPeople = allPeople.concat(data.data);
    
    if (!data.links?.next) break;
    offset += perPage;
  }
  
  return allPeople;
}
```
