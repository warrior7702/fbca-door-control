# FBCA Door Control - Feature Roadmap

**Last Updated:** 2026-02-16 16:57 CST

---

## ✅ COMPLETED (Phase 1 & 2)

- [x] Core system: Database, API, UI, door sync
- [x] Multi-door scheduling (batch events across buildings)
- [x] Per-building custom times (Wade, Main Church, Student Center, PCB)
- [x] Background scheduler (30-second checks)
- [x] Priority system (prevents conflicts with MonitorCast)
- [x] Re-unlock monitoring (Option C - fights MonitorCast locks)
- [x] Event-centered calendar view
- [x] Door filtering (41 clean doors, readers/emergency exits hidden)
- [x] Audit logging

---

## 🎯 SOON (High Priority)

### 1. Recurring Weekly Schedules
**Goal:** "Every Sunday 8:00 AM - 12:00 PM, unlock Main Church"

**Technical Approach:**
- Add `RecurrencePattern` table (weekly, biweekly, monthly)
- Background service generates instances 2-4 weeks ahead
- UI: "Repeat weekly" checkbox in event modal

**Complexity:** Medium (2-3 days)

---

### 2. PCO Sync for Automated Events
**Goal:** Planning Center events that request unlock → auto-schedule doors

**Technical Approach:**
- PCO API integration (OAuth 2.0)
- Poll for new events with "Door Unlock Requested" custom field
- Map event location → building doors
- Auto-create unlock schedules

**Questions:**
- How do events "ask for unlock"? Custom field? Event type? Category?
- Which PCO calendar(s) to sync? (All, or specific like "Facility Reservations"?)

**Complexity:** High (1 week)

---

### 3. Camera Integration (Spot.ai)
**Goal:** Live camera view + lock/unlock buttons on same screen

**Technical Approach:**
- Spot.ai API integration (camera feeds, PTZ controls if supported)
- New UI page: Door grid with camera thumbnails
- Click door → full camera view + lock/unlock buttons

**Questions:**
- Spot.ai API docs available?
- Do you have API credentials?
- Live stream or snapshots?

**Complexity:** Medium-High (4-5 days)

---

### 4. Hosting & Access
**Current:** Local network only (10.5.5.31:5002)

**Questions:**
- **Internet access needed?** (View from home, on-call staff, etc.)
- If yes:
  - Reverse proxy (IIS with SSL cert)?
  - VPN (Tailscale/corporate VPN)?
  - Port forward with firewall rules?

**Recommendation:** Start with VPN (Tailscale already setup), add public later if needed.

---

### 5. Authentication & Authorization
**Goal:** SSO Microsoft Office (Azure AD) with admin/viewer levels

**Technical Approach:**
- Azure AD OAuth 2.0 integration
- Two roles:
  - **Admin:** Create/edit/delete schedules, lock/unlock doors
  - **Viewer:** See schedules, see camera feeds (read-only)
- JWT tokens in cookies/localStorage

**FBCA Azure AD:**
- Tenant: firstbaptistchurcharlington.onmicrosoft.com (?)
- Need app registration in Azure portal

**Complexity:** Medium (3-4 days)

---

## 🔮 LATER (Phase 3+)

### 1. Full Schedule Takeover
**Goal:** Import all MonitorCast schedules & access levels, manage cards/codes

**Technical Approach:**
- Parse VIA database (Doors, Schedules, AccessLevels, Cards, Codes)
- Migrate to our system
- Retire MonitorCast for scheduling (keep as hardware interface only)

**Risk:** High - full replacement of production system

**Complexity:** Very High (2-3 weeks)

---

### 2. FBCA OS Integration
**Goal:** Bi-directional sync with FBCA OS app (keep DB current)

**Technical Approach:**
- REST API endpoints for FBCA OS
- Webhooks for real-time updates
- Shared authentication (both use Azure AD)

**Depends On:** FBCA OS production readiness (security audit in progress)

**Complexity:** Medium (1 week)

---

## 📋 Next Steps

1. **Billy decides:** Which SOON feature to start first?
2. **Answer questions:** PCO integration details, Spot.ai access, hosting preferences
3. **Authentication setup:** Azure AD app registration (can do in parallel)
4. **Plan sprint:** Break chosen feature into tasks

---

## Technical Debt / Improvements

- [ ] Add unit tests (currently none)
- [ ] API rate limiting
- [ ] Better error handling (currently logs to console)
- [ ] Health check endpoint improvements
- [ ] Database indexes (performance optimization)
- [ ] Logging to file (currently console only)

---

## Questions for Billy

1. **Recurring schedules:** Weekly only, or also biweekly/monthly?
2. **PCO sync:** How do events request unlock? Which calendar(s)?
3. **Spot.ai:** Do you have API credentials? Documentation link?
4. **Hosting:** Internet access needed now, or local-only for a while?
5. **Azure AD:** Do you have admin access to create app registration?

---

_This roadmap guides Phase 3 development. Update as priorities shift._
