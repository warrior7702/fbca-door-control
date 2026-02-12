# 🚪 FBCA Door Control System

**Automated door unlock/lock scheduling for First Baptist Church Arlington**

Replace MonitorCast's clunky UI with a modern calendar interface. Schedule door unlocks/locks ahead of time and let the system handle it automatically.

---

## 🎯 Features

- 📅 **Visual Calendar** - FullCalendar interface with month/week/day views
- ⏰ **Automated Scheduling** - Background service unlocks/locks doors on schedule
- 🏢 **58 Doors** - Wade, Main Church, Student Building, PCB, and more
- 🔍 **Audit Trail** - Complete logging of every action
- 🔄 **VIA Sync** - Reads door list from VIA database (read-only, safe)
- ❤️ **Health Monitoring** - Real-time system status checks

---

## 🚀 Quick Start

**Prerequisites:**
- .NET 8.0 SDK
- SQL Server access (VIAC database + ability to create FBCADoorControl database)
- MonitorCast running on localhost:8080

**Deploy on 10.5.5.31:**

```bash
# 1. Copy project to server
# 2. Edit appsettings.json (set MonitorCast password)

# 3. Create database
dotnet ef database update

# 4. Run the app
dotnet run

# 5. Open browser: http://localhost:5002
```

**First time setup:**
1. Click "Open Calendar"
2. Click "🔄 Sync Doors" to load 58 doors from VIA
3. Create a test schedule
4. Watch it execute automatically!

📖 **Full deployment guide:** See `DEPLOY.md`

---

## 📁 Project Structure

```
fbca-door-control/
├── Controllers/        # API endpoints (Doors, Schedules, Health)
├── Services/          # Business logic (QuickControls, DoorSync, Scheduler)
├── Data/             # Database contexts (FBCADoorControl, VIAC)
├── Models/           # Entities and DTOs
├── wwwroot/          # Frontend (HTML, CSS, JS)
│   ├── index.html    # Landing page
│   ├── calendar.html # Main calendar UI
│   ├── css/          # Styles
│   └── js/           # FullCalendar logic
├── Program.cs        # App entry point
└── appsettings.json  # Configuration

📚 Documentation:
├── README.md         # This file
├── DEPLOY.md         # Deployment instructions
├── ARCHITECTURE.md   # Technical architecture
├── PROJECT_SPEC.md   # Requirements & scope
├── TASK_LIST.md      # Development tasks
└── DEVLOG.md         # Build log
```

---

## 🔧 Configuration

Edit `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "FBCADoorControl": "Server=FBCA-SQL;Database=FBCADoorControl;Trusted_Connection=True;",
    "VIAC": "Server=FBCA-SQL;Database=VIAC;Trusted_Connection=True;"
  },
  "MonitorCast": {
    "BaseUrl": "http://localhost:8080",
    "Username": "admin",
    "Password": "YOUR_PASSWORD_HERE"
  },
  "Scheduler": {
    "CheckIntervalSeconds": 30
  }
}
```

---

## 📊 Database

**FBCADoorControl** (our database):
- `Doors` - Mirror of VIA doors (synced from VIAC.Doors)
- `UnlockSchedules` - Scheduled unlock/lock times
- `ScheduleActionLog` - Audit trail (immutable)

**VIAC** (read-only):
- Source of truth for door list
- Never written to (safety)

---

## 🎨 How It Works

1. **Background Scheduler** runs every 30 seconds
2. Checks for schedules with `UnlockTime` or `LockTime` near current time
3. Calls **MonitorCast Quick Controls API** to unlock/lock door
4. Logs every action to `ScheduleActionLog`
5. UI auto-refreshes every 30 seconds

**MonitorCast Integration:**
- POST `http://localhost:8080/Dashboard/LockUnlockDoor`
- Handles authentication, session management, retries
- 30-minute session timeout (MonitorCast limitation)

---

## 🔒 Security

**Phase 1-2:** No authentication (internal network only)  
**Phase 3:** Will add authentication and role-based access

**Audit Trail:**
- Every unlock/lock action logged with timestamp, user, result
- Immutable log (append-only, never deleted)

**VIA Database:**
- READ-ONLY access (can't break current system)
- MonitorCast remains as backup control

---

## 🎯 Roadmap

**Phase 1: Core System ✅**
- Database, services, controllers, UI
- Manual schedule creation
- Background automation

**Phase 2: Testing & Polish** (Current)
- Deploy to 10.5.5.31
- Test with real VIA database
- Test MonitorCast integration
- Production deployment

**Phase 3: PCO Integration** (Future)
- Automatically create schedules from Planning Center Online events
- "Someone schedules event → doors unlock automatically"

---

## 📞 Support

**Built by:** Cornerstone (AI Agent)  
**Approved by:** Billy Nelms  
**Date:** February 11, 2026

**Documentation:**
- Technical: `ARCHITECTURE.md`
- Deployment: `DEPLOY.md`
- Development: `DEVLOG.md`

---

**Status:** ✅ Phase 1 Complete - Ready for Testing
