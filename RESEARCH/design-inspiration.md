# Design Inspiration for FBCA Door Control UI/UX

Research Date: March 3, 2026
Source: Analysis of leading access control platform interfaces

---

## Executive Summary

Modern access control platforms share common design patterns that prioritize clarity, speed, and mobile-first experiences. This document extracts the best UI/UX patterns from Brivo, Verkada, Kisi, Openpath, and RemoteLock to inform FBCA Door Control design improvements.

---

## 1. Dashboard Design Patterns

### 1.1 "Command Center" Layout

**Pattern:**
- Single-page dashboard with at-a-glance system health
- Status indicators use color-coded badges (green/orange/red)
- Quick action buttons prominently placed
- Recent activity feed as primary content

**Best Example: Verkada Command**
```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]    Dashboard    Doors    Users    Reports    ⚙️  🔔 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 🟢 Online    │ │ 🟡 Warning   │ │ 🔴 Offline   │        │
│  │ 12 Doors     │ │ 2 Doors      │ │ 0 Doors      │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  [GLOBAL LOCKDOWN]        [+ Add Door]  [Export Report]    │
│                                                             │
│  Recent Activity                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Time     Door           User           Action        │  │
│  │ 2:34 PM  Main Entrance  John Smith     Unlocked      │  │
│  │ 2:15 PM  North Wing     Sarah Jones    Access Denied │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Takeaways:**
- Status cards are large, tappable/clickable
- Primary actions use contrasting button colors
- Activity feed shows most recent first with infinite scroll

### 1.2 Brivo's Card-Based Layout

**Pattern:**
- Dashboard uses card metaphor for each door
- Each card shows: Door name, status, last activity, quick actions
- Cards can be expanded inline for details

```
┌─────────────────────────────────────────────────────────────┐
│  Main Building Entrance                           [•••]     │
│  🟢 Online                                                  │
│  Last access: 2 min ago by Billy                            │
│  [Unlock] [View Log] [Edit]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Takeaways:**
- Card layout scales well from desktop to mobile
- Each card is self-contained with its own actions
- Visual hierarchy: Status > Name > Actions

---

## 2. Navigation Patterns

### 2.1 Horizontal Tab Navigation (Desktop)

**Best Example: Kisi Dashboard**
- Primary nav: Dashboard | Places | Access | Activity | Settings
- Secondary nav (under Places): Doors | Elevators | Cameras
- Breadcrumb for deep navigation

**Pattern:**
```
Dashboard > Main Campus > Building A > North Entrance
[Overview] [Live View] [History] [Settings]
```

### 2.2 Bottom Navigation (Mobile)

**Pattern Used By:** Brivo, Openpath, Verkada

```
┌──────────────────────────────────────┐
│           [Mobile Screen]            │
│                                      │
│          [Content Area]              │
│                                      │
│  🏠      🚪      👥      📊      ⚙️   │
│ Home   Doors   Users  Activity  More │
└──────────────────────────────────────┘
```

**Key Takeaways:**
- Bottom nav keeps thumbs within reach
- Icons + labels for clarity
- "More" as overflow for less-used features

### 2.3 Contextual Sidebar

**Best Example: RemoteLock**
- Collapsible sidebar on desktop
- Shows filtered views: All Doors | Active | Offline | Scheduled
- Search always visible at top

---

## 3. Door Management Interface

### 3.1 Door Detail View

**Best Example: Openpath/Avigilon**

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]  Main Entrance                      [Edit] [⚙️]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: 🟢 Online        Controller: AC41-2847            │
│  Last seen: 2 seconds ago                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [🔓 Unlock Door]          [📹 View Camera]         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Current Schedule                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Mon-Fri: 6:00 AM - 10:00 PM                        │   │
│  │ Sat-Sun: 8:00 AM - 8:00 PM                         │   │
│  │ Holidays: Locked                                   │   │
│  │ [Edit Schedule]                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Recent Activity                         [View All →]       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2:34 PM  Unlocked    Billy Clanton   Mobile        │   │
│  │ 2:15 PM  Locked      Auto            Schedule      │   │
│  │ 1:45 PM  Unlocked    Jane Doe        Card          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key Takeaways:**
- Unlock button is the primary action - large and prominent
- Status is always visible and updates in real-time
- Activity history is immediately accessible
- Schedule shows in human-readable format (not cron)

### 3.2 Door List View

**Pattern:**
- Sortable columns: Name | Status | Last Activity | Schedule
- Filter chips: All | Online | Offline | Unlocked | Locked
- Bulk select checkbox for mass operations

**Verkada's Approach:**
- Table view with sortable headers
- Status as colored dot + text
- Hover reveals quick actions
- Click row for detail panel (not full page)

### 3.3 Floor Plan View

**Best Example: Brivo Enterprise**

**Pattern:**
- Upload SVG or image floor plan
- Door icons positioned on plan
- Color-coded status: Green (unlocked) / Red (locked) / Gray (offline)
- Click door icon for quick controls popup

```
┌─────────────────────────────────────────────────────────────┐
│  [Floor Plan View]       [List View]       [+ Upload Plan]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌─────────┐                              │
│                    │  Main   │                              │
│                    │  [🟢]   │ ← Click for popup            │
│                    └────┬────┘                              │
│                         │                                   │
│    ┌─────────┐    ┌─────┴─────┐    ┌─────────┐             │
│    │  East   │────│  Lobby    │────│  West   │             │
│    │  [🔴]   │    │           │    │  [🟢]   │             │
│    └─────────┘    └───────────┘    └─────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. User & Access Management

### 4.1 User List Pattern

**Best Example: Kisi**

**Features:**
- Search bar with filters: Active | Deactivated | Pending
- User cards with avatar, name, email, access level
- Bulk actions toolbar appears on selection

```
┌─────────────────────────────────────────────────────────────┐
│  [Search users...]    [Filter ▼]    [+ Add User]            │
├─────────────────────────────────────────────────────────────┤
│  [ ] Name              Email              Access    Status  │
│  ─────────────────────────────────────────────────────────  │
│  [ ] 👤 Billy C.       billy@fbca.org   Admin    Active    │
│  [ ] 👤 Jane Doe       jane@fbca.org    User     Active    │
│  [ ] 👤 Bob Smith      bob@fbca.org     User     Pending   │
│                                                             │
│  [Delete Selected]  [Export CSV]  [Bulk Edit]               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Granting Access Flow

**Best Example: RemoteLock**

**Step-by-Step Wizard:**
1. **Select User(s)** - Search or create new
2. **Select Doors** - Multi-select with checkboxes
3. **Set Schedule** - Presets or custom
4. **Review & Confirm** - Summary before apply

**Key UX Patterns:**
- Progress indicator (Step 1 of 4)
- "Back" always available
- Summary page prevents errors
- Success confirmation with toast notification

### 4.3 Calendar/Schedule Interface

**Current FBCA Pattern:** Weekly code display

**Recommended Enhancement:**

```
┌─────────────────────────────────────────────────────────────┐
│  Schedule: Main Entrance                          [Edit]    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │     Sun   Mon   Tue   Wed   Thu   Fri   Sat        │   │
│  │ AM  🔓    🔓    🔓    🔓    🔓    🔓    🔓          │   │
│  │ PM  🔓    🔓    🔓    🔓    🔓    🔓    🔓          │   │
│  │ EV  🔒    🔓    🔓    🔓    🔓    🔓    🔒          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Exceptions:                                                │
│  • Dec 25 - Locked (Holiday)                                │
│  • Jan 1 - Locked (Holiday)                                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Visual calendar showing lock/unlock periods
- Drag-to-select for bulk editing
- Exception dates clearly marked
- Time sliders for fine-tuning

---

## 5. Mobile App Patterns

### 5.1 Unlock Experience

**Best Example: Openpath "Wave to Unlock"**

**Flow:**
1. User approaches door with phone in pocket
2. Bluetooth detects proximity
3. User waves hand near reader (no phone removal)
4. Haptic feedback confirms unlock
5. Door unlocks

**Mobile App UI:**
```
┌──────────────────────────────────────┐
│           [FBCA Access]              │
│                                      │
│   ┌──────────────────────────────┐   │
│   │                              │   │
│   │      [🚪 Wave Icon]          │   │
│   │                              │   │
│   │   Approach door and wave     │   │
│   │      to unlock               │   │
│   │                              │   │
│   └──────────────────────────────┘   │
│                                      │
│   Your Doors:                        │
│   ┌──────────────────────────────┐   │
│   │ Main Entrance       [Unlock] │   │
│   │ North Wing          [Unlock] │   │
│   │ Admin Office        [Unlock] │   │
│   └──────────────────────────────┘   │
│                                      │
│   Recent Activity                    │
│   • 2:34 PM - Main Entrance          │
│   • Yesterday - North Wing           │
│                                      │
└──────────────────────────────────────┘
```

**Key UX Principles:**
- Large tap targets (44px minimum)
- Haptic feedback on actions
- Offline capability with queued actions
- Biometric auth (FaceID/TouchID) before unlock

### 5.2 Real-Time Notifications

**Pattern:**
- Rich notifications with action buttons
- Swipe to unlock from notification
- Grouped by door

```
┌──────────────────────────────────────┐
│  🔓 Door Unlocked                    │
│  Main Entrance was unlocked at 2:34  │
│  PM by Billy Clanton                 │
│                                      │
│  [Lock Now]  [View Camera]           │
└──────────────────────────────────────┘
```

---

## 6. Activity & Reporting Interface

### 6.1 Activity Feed

**Best Example: Brivo Event Stream**

**Features:**
- Infinite scroll
- Filter by: Door | User | Event Type | Date Range
- Export button always available
- Visual icons for event types

```
┌─────────────────────────────────────────────────────────────┐
│  Activity Feed                    [Filter] [Export CSV]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Today                                                      │
│  ─────────────────────────────────────────────────────────  │
│  🔓 2:34 PM  Main Entrance    Billy C.     Unlocked        │
│  🔒 2:30 PM  Main Entrance    Auto         Locked          │
│  ❌ 2:15 PM  North Wing       Unknown      Access Denied   │
│                                                             │
│  Yesterday                                                  │
│  ─────────────────────────────────────────────────────────  │
│  🔓 5:45 PM  Admin Office     Jane D.      Unlocked        │
│  🔓 8:30 AM  Main Entrance    Bob S.       Unlocked        │
│                                                             │
│  [Load More...]                                             │
└─────────────────────────────────────────────────────────────┘
```

**Event Type Icons:**
- 🔓 Unlocked
- 🔒 Locked
- ❌ Access Denied
- ⚠️ Door Held Open
- 🔑 Schedule Changed
- 👤 User Added/Removed

### 6.2 Report Builder

**Pattern:**
- Pre-built report templates
- Custom date range selector
- Preview before download

**Templates:**
- Daily Access Summary
- Failed Access Attempts
- Door Usage by Hour
- User Activity Report
- Audit Log (Admin Actions)

---

## 7. Emergency UI Patterns

### 7.1 Lockdown Interface

**Critical Design Requirements:**
- Prominent but protected (confirm dialog)
- Clear visual feedback
- Status of each door during lockdown
- One-click "All Clear" to resume normal operation

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ EMERGENCY LOCKDOWN ACTIVATED ⚠️                        │
├─────────────────────────────────────────────────────────────┤
│  Activated by: Billy Clanton at 2:34 PM                     │
│  Reason: [Fire Alarm - Auto Triggered]                      │
│                                                             │
│  Door Status:                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Main Entrance    🔒 Locked            ✓ Secure      │   │
│  │ North Wing       🔒 Locked            ✓ Secure      │   │
│  │ Admin Office     🟡 Unlocked          ⚠️ Check      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [🔓 END LOCKDOWN - ALL DOORS]                              │
│  [Unlock Individual Door...]                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Visual Design System Recommendations

### 8.1 Color Palette

**Status Colors:**
- Online/Active: `#10B981` (Green-500)
- Warning/Unlocked: `#F59E0B` (Amber-500)
- Offline/Error: `#EF4444` (Red-500)
- Info/Neutral: `#3B82F6` (Blue-500)

**Action Colors:**
- Primary: `#2563EB` (Blue-600)
- Secondary: `#6B7280` (Gray-500)
- Danger: `#DC2626` (Red-600)

### 8.2 Typography

**Hierarchy:**
- Page Title: 24px / Bold
- Section Header: 18px / Semibold
- Card Title: 16px / Medium
- Body: 14px / Regular
- Caption/Meta: 12px / Regular

### 8.3 Spacing

**Layout Grid:**
- Base unit: 8px
- Card padding: 16px
- Section gap: 24px
- Page margin: 24px (desktop), 16px (mobile)

### 8.4 Icons

**Recommended Set:** Lucide or Heroicons
- Consistent stroke width (1.5-2px)
- Filled variants for active states
- Clear metaphor (unlock = open padlock)

---

## 9. Responsive Design Patterns

### 9.1 Breakpoints

**Desktop:** 1200px+
- Sidebar navigation
- Multi-column layouts
- Full-featured tables

**Tablet:** 768px - 1199px
- Collapsible sidebar
- 2-column grid for cards
- Simplified tables

**Mobile:** < 768px
- Bottom navigation
- Single column
- Cards stack vertically
- Tables become lists

### 9.2 Mobile-Specific Patterns

**Touch Targets:**
- Minimum 44x44px
- Generous spacing between actions
- Swipe gestures for common actions

**Progressive Disclosure:**
- Show summary, tap for detail
- "Show more" for long lists
- Bottom sheets for forms

---

## 10. Key Recommendations Summary

1. **Adopt card-based layouts** - Scales beautifully across devices
2. **Prioritize the unlock action** - Make it the most prominent button
3. **Real-time feedback** - Status changes should animate and notify
4. **Mobile-first design** - Many admins will manage from phones
5. **Use clear iconography** - Visual cues speed comprehension
6. **Implement progressive disclosure** - Don't overwhelm with options
7. **Maintain consistent spacing** - 8px grid system
8. **Design for emergencies** - Lockdown needs clear, protected UI
9. **Support offline mode** - Cache data for connectivity issues
10. **Always provide escape hatches** - Clear back/cancel options

---

*Analysis based on: Brivo Access, Verkada Command, Kisi Platform, Avigilon Alta, RemoteLock, and HID Mobile Access interfaces.*
