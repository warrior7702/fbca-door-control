# Feature Ideas for FBCA Door Control

Research Date: March 3, 2026
Source: Commercial door access control market research

---

## Executive Summary

Based on analysis of leading commercial access control platforms (Brivo, Openpath/Avigilon, Verkada, Kisi, RemoteLock, HID), this document outlines feature recommendations to enhance the FBCA Door Control system. The physical access control market is projected to grow from $10.81B (2025) to $18.51B by 2030, with key trends including mobile credentials, cloud management, and AI-powered monitoring.

---

## Priority 1: Essential Features (Immediate Impact)

### 1.1 Mobile Credentials & Remote Unlock

**What Leading Systems Do:**
- **Openpath/Avigilon**: "Wave to Unlock" - hands-free entry without removing phone from pocket
- **Brivo**: Mobile Pass with 99.9% unlock reliability via "Triple Unlock" technology
- **Kisi**: Mobile-first platform with iOS/Android SDK for white-label apps
- **Verkada**: NFC mobile credentials in Apple Wallet

**Current Gap:**
- FBCA currently relies on door codes; no mobile credential support

**Recommendation:**
- Add mobile app with remote unlock capability
- Support Bluetooth proximity unlocking
- Consider "wave to unlock" for touchless entry (reduces tailgating by 40%)

### 1.2 Real-Time Event Monitoring & Alerts

**What Leading Systems Do:**
- **Brivo**: Real-time event tracking with email alerts
- **Verkada**: Live access event streaming with video correlation
- **RemoteLock**: Event reporting with timestamp, door, event type, method of entry

**Current Gap:**
- Limited real-time visibility into door access events

**Recommendation:**
- Live event feed showing who accessed which door and when
- Configurable alerts for:
  - Failed access attempts
  - After-hours access
  - Door held open too long
  - Emergency unlock events

### 1.3 Emergency Lockdown Capability

**What Leading Systems Do:**
- **Openpath**: "Lock Down" - custom facility lockdowns activated from anywhere
- **Brivo**: Facility lockdown with emergency scenarios
- **Verkada**: Instant sitewide lockdown with single touch

**Current Gap:**
- No centralized emergency lockdown feature

**Recommendation:**
- One-click global lockdown button
- Scheduled lockdown drills
- Integration with fire alarm systems for automatic unlock

---

## Priority 2: Operational Efficiency Features

### 2.1 Occupancy Tracking & Analytics

**What Leading Systems Do:**
- **Brivo Professional/Enterprise**: Occupancy tracking with trend analysis
- **RemoteLock**: Data on "people flow" and space utilization
- **Avigilon**: Real-time building occupancy data for compliance

**Current Gap:**
- No visibility into building occupancy patterns

**Recommendation:**
- Real-time occupancy counter per door/building
- Historical occupancy reports (peak times, average usage)
- Integration with calendar data for predictive occupancy

### 2.2 Bulk Operations & Scheduling

**What Leading Systems Do:**
- **Brivo Enterprise**: Bulk actions for user management
- **RemoteLock**: Custom schedules with "access exception" (holiday) schedules
- **Kisi**: API-first approach for automation

**Current Gap:**
- Manual per-door scheduling is time-consuming

**Recommendation:**
- Bulk user import/export (CSV)
- Bulk schedule assignment across multiple doors
- Holiday/exception schedule templates
- Recurring schedule patterns (weekly, monthly)

### 2.3 Delivery Pass / Temporary Access

**What Leading Systems Do:**
- **ButterflyMX**: Delivery passes - electronic credentials via text with PIN/QR code
- **Openpath**: Guest passes with automatic expiration
- **Brivo**: Brivo Visitor with visitor management

**Current Gap:**
- No automated temporary access for vendors/deliveries

**Recommendation:**
- Self-expiring PIN codes for deliveries
- QR code-based temporary access
- SMS/email delivery of temporary credentials
- Automatic expiration after single use or time limit

---

## Priority 3: Advanced Security Features

### 3.1 Anomaly Detection & AI Monitoring

**What Leading Systems Do:**
- **Brivo Enterprise**: Anomaly detection for unusual access patterns
- **Acre Security**: AI-powered monitoring flags anomalies in real-time (60% faster incident response)
- **Avigilon**: AI analytics for unusual behavior detection

**Market Trend:**
- 97% of access anomalies currently go unnoticed until after an incident
- AI-based monitoring becoming standard in enterprise systems

**Recommendation:**
- Detect duplicate simultaneous badge usage
- Flag after-hours access by typically daytime-only users
- Alert on repeated failed attempts at same door
- Detect "piggybacking" or tailgating patterns

### 3.2 Video Integration & Visual Verification

**What Leading Systems Do:**
- **Avigilon**: Live video built directly into reader for visual verification
- **Verkada**: Native integration between access control and video security
- **Brivo**: Video snapshot at access events

**Current Gap:**
- No video correlation with door access events

**Recommendation:**
- Integration with Spot.ai cameras
- Video clip capture on access events
- Side-by-side view of event log + video feed
- Search events by visual identification

### 3.3 Multi-Factor Authentication

**What Leading Systems Do:**
- **Brivo**: Multi-factor authentication options
- **Openpath**: 2-factor authorization support
- **HID**: Biometric options (fingerprint, mobile FaceID integration)

**Recommendation:**
- Optional MFA for high-security areas
- PIN + card/credential requirement
- Biometric integration for sensitive doors

---

## Priority 4: Integration & Scalability

### 4.1 API & Third-Party Integrations

**What Leading Systems Do:**
- **Kisi**: Full API + mobile SDK for iOS/Android
- **Brivo**: Open API with integration marketplace
- **Openpath**: Integrates with visitor management, HR software, GSuite, elevators
- **RemoteLock**: Directory integrations (Active Directory, Google Workspace)

**Current Gap:**
- Limited API surface for integrations

**Recommendation:**
- REST API for all core functions
- Webhook support for real-time event notifications
- Integration with:
  - Planning Center Online (current integration exists - expand)
  - Microsoft 365 / Google Workspace
  - Visitor management systems
  - HR systems for automatic user provisioning

### 4.2 Multi-Site Management

**What Leading Systems Do:**
- **Brivo Enterprise**: Global view across multiple sites
- **Verkada**: Scale across 10 doors or 10,000
- **RemoteLock**: Single dashboard for all properties

**Current Gap:**
- Single-site focus; no multi-location support

**Recommendation:**
- Multi-site dashboard with location switching
- Cross-site user management
- Site-specific admin permissions
- Global reporting across all sites

### 4.3 Role-Based Access Control (RBAC)

**What Leading Systems Do:**
- **Brivo**: Role-based admin permissions
- **Verkada**: Granular user permissions
- **RemoteLock**: Building manager vs tenant vs admin roles

**Current Gap:**
- Limited role differentiation

**Recommendation:**
- Admin roles: Super Admin, Building Manager, Door Admin, Viewer
- Tenant roles: Self-service user management within their assigned doors
- Audit logging of all admin actions

---

## Priority 5: User Experience Enhancements

### 5.1 Self-Service Portal

**What Leading Systems Do:**
- **Kisi**: Users can manage their own access
- **Brivo**: User portal for credential management

**Recommendation:**
- User self-service for:
  - Viewing their access permissions
  - Reporting lost credentials
  - Requesting temporary access
  - Viewing their own access history

### 5.2 Touchless Entry Options

**Market Trend:**
- Touchless access reduces surface contact by 80%
- Wave-to-open sensors becoming standard

**Recommendation:**
- Wave-to-unlock (no phone removal needed)
- Automatic unlock when approaching with authorized mobile device
- QR code scanning for visitors

### 5.3 Digital Floor Plans

**What Leading Systems Do:**
- **Brivo Enterprise**: Floor plan integration showing door status
- **Genetec**: Visual map-based door control

**Recommendation:**
- Upload building floor plans
- Visual door status indicators on map
- Click-to-unlock from floor plan view
- Emergency evacuation routing display

---

## Implementation Roadmap

### Phase 1 (0-3 months): Core Improvements
- Real-time event monitoring dashboard
- Emergency lockdown capability
- Enhanced reporting with export

### Phase 2 (3-6 months): Mobile & Remote
- Mobile app with remote unlock
- Push notifications for events
- Basic occupancy tracking

### Phase 3 (6-12 months): Advanced Features
- API expansion for integrations
- Anomaly detection
- Video integration with Spot.ai
- Multi-site support architecture

---

## Key Takeaways

1. **Mobile credentials are table stakes** - Every major platform offers them; they're expected by users
2. **Cloud management is standard** - Remote management from any device is the norm
3. **Integration is critical** - Systems must talk to HR, visitor management, and video
4. **AI is coming** - Anomaly detection and predictive analytics are differentiating features
5. **User experience matters** - Touchless entry and self-service reduce friction and improve adoption

---

*Research compiled from: Brivo, Avigilon/Openpath, Verkada, Kisi, RemoteLock, HID Global, ButterflyMX, Acre Security, and industry market reports.*
