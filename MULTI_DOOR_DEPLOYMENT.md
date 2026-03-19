# Multi-Door Event Feature - Deployment Guide

**Created:** 2026-02-16
**Status:** Ready to Deploy

## Overview

Added multi-door event scheduling feature that allows creating schedules for multiple doors across multiple buildings in a single operation, with optional per-building time overrides.

## Changes Made

### Backend Changes

1. **New API Endpoint:** `POST /api/schedules/batch`
   - File: `Controllers/SchedulesController.cs`
   - Accepts batch schedule creation with optional per-door time overrides
   - Returns success count and any errors

2. **New DTOs:**
   - File: `Models/DTOs/ScheduleDto.cs`
   - `BatchScheduleDoorRequest` - Individual door with optional custom times
   - `CreateBatchScheduleRequest` - Batch request with default times + door list
   - `BatchScheduleCreateResponse` - Response with success/error counts

### Frontend Changes

1. **New Button:** "Create Multi-Door Event" button added to calendar nav bar
   - File: `wwwroot/calendar.html`

2. **New Modal:** Multi-door event wizard (2-step process)
   - Step 1: Event details (name, default unlock/lock times)
   - Step 2: Select doors from all 4 buildings with custom time overrides per building
   - File: `wwwroot/calendar.html`

3. **New CSS Styles:**
   - File: `wwwroot/css/calendar.css`
   - Styles for building sections, checkboxes, custom time boxes, preview

4. **New JavaScript Functions:**
   - File: `wwwroot/js/calendar.js`
   - `showMultiDoorModal()` - Opens wizard
   - `multiDoorNext()` / `multiDoorBack()` - Navigate wizard steps
   - `populateMultiDoorCheckboxes()` - Populate door checkboxes by building
   - `toggleCustomTimes()` - Toggle custom times per building
   - `selectAllBuilding()` - Select all doors in a building
   - `updateMultiDoorSelection()` - Update preview of selected doors
   - `createMultiDoorEvent()` - Call batch API and create schedules

## Files to Deploy

Copy these files to the server (10.5.5.31):

### Backend (Requires rebuild & restart)
```
Controllers/SchedulesController.cs
Models/DTOs/ScheduleDto.cs
```

### Frontend (No rebuild needed - just copy files)
```
wwwroot/calendar.html
wwwroot/css/calendar.css
wwwroot/js/calendar.js
```

## Deployment Steps

### Option 1: Full Rebuild (Recommended)

1. **On development machine:**
   ```bash
   cd /Users/fbclaude/.openclaw/workspace/fbca-door-control
   dotnet build --configuration Release
   ```

2. **Copy published files to server**

3. **On server:**
   - Stop the service
   - Replace files
   - Start the service

### Option 2: Quick Frontend Update (No backend rebuild)

If you want to test the UI first without backend:

1. **Copy frontend files to server:**
   ```
   wwwroot/calendar.html
   wwwroot/css/calendar.css
   wwwroot/js/calendar.js
   ```

2. **Hard refresh browser:** `Ctrl + Shift + R`

3. **Note:** Backend API won't work until you rebuild and deploy

### Option 3: Full Deploy (Both)

1. **Build and publish:**
   ```bash
   cd /Users/fbclaude/.openclaw/workspace/fbca-door-control
   dotnet publish --configuration Release --output ./publish
   ```

2. **Copy entire `publish/` folder to server**

3. **Restart service**

## Testing

1. **Open calendar:** http://10.5.5.31:5002/calendar.html

2. **Click "Create Multi-Door Event" button**

3. **Step 1: Fill in event details**
   - Event Name: "Test Multi-Door Event"
   - Default Unlock Time: Tomorrow 8:00 AM
   - Default Lock Time: Tomorrow 5:00 PM
   - Click "Next: Select Doors →"

4. **Step 2: Select doors**
   - Check 2-3 doors from Wade Building
   - Check 2-3 doors from Main Church
   - Click "⏰ Custom Times" for Wade Building
   - Set Wade to unlock at 7:30 AM (30 min earlier)
   - Click "Create Event"

5. **Verify:**
   - Should see success message
   - Calendar should show multiple events with same name
   - Wade doors should have 7:30 AM start time
   - Main Church doors should have 8:00 AM start time

## Features

- ✅ Multi-door selection across all 4 buildings
- ✅ Per-building custom time overrides
- ✅ "Select All" for each building
- ✅ Live preview of selected doors
- ✅ Visual indicators for custom times
- ✅ 2-step wizard interface
- ✅ Creates multiple linked schedules with same event name
- ✅ Backend validates all doors and reports errors individually

## Database

**No schema changes required!** Uses existing `UnlockSchedule` table. Multiple schedules are created with the same `ScheduleName` to link them as one event.

## Rollback

If issues occur:

1. **Frontend only:** Copy old versions of:
   - wwwroot/calendar.html
   - wwwroot/css/calendar.css
   - wwwroot/js/calendar.js

2. **Backend:** Revert commits and redeploy previous version

## Notes

- Batch API endpoint is idempotent - can retry safely
- Individual door failures don't block other doors (partial success)
- All times are stored in UTC (converted by frontend)
- Scheduler service picks up new schedules within 30 seconds
- Custom times per building (not per door) - simplifies UI and covers 99% of use cases
