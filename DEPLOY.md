# FBCA Door Control System - Deployment Guide

**Target Server:** 10.5.5.31 (Windows Server with VIA database and MonitorCast)

---

## Prerequisites on 10.5.5.31

1. **.NET 8.0 SDK** installed
   - Download: https://dotnet.microsoft.com/download/dotnet/8.0
   - Or check if installed: `dotnet --version`

2. **SQL Server access** to:
   - VIAC database (read-only for door sync)
   - Permission to create FBCADoorControl database

3. **MonitorCast running** on localhost:8080

---

## Deployment Steps

### 1. Copy Project to Server

**Option A - From Mac to Windows:**
```bash
# On your Mac:
cd ~/.openclaw/workspace
scp -r fbca-door-control/ administrator@10.5.5.31:C:/Projects/
```

**Option B - Manual copy:**
- Zip the `fbca-door-control/` folder
- Copy to server via network share or USB
- Extract to `C:\Projects\fbca-door-control\`

---

### 2. Configure Settings

Edit `appsettings.json` on the server:

```json
{
  "ConnectionStrings": {
    "FBCADoorControl": "Server=FBCA-SQL;Database=FBCADoorControl;Trusted_Connection=True;TrustServerCertificate=True;",
    "VIAC": "Server=FBCA-SQL;Database=VIAC;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "MonitorCast": {
    "BaseUrl": "http://localhost:8080",
    "Username": "admin",
    "Password": "YOUR_MONITORCAST_PASSWORD_HERE",
    "SessionTimeoutMinutes": 30,
    "RetryAttempts": 3,
    "RetryDelaySeconds": 5
  }
}
```

**Required changes:**
- ✅ `MonitorCast.Password` - Replace with actual MonitorCast admin password
- ✅ Check `Server=FBCA-SQL` is correct SQL Server name
- ✅ Verify `BaseUrl` is `http://localhost:8080`

---

### 3. Create Database

On the server, open PowerShell/CMD in project folder:

```bash
cd C:\Projects\fbca-door-control

# Install EF Core tools (if not already installed)
dotnet tool install --global dotnet-ef

# Create database and tables
dotnet ef database update
```

This will create the `FBCADoorControl` database with 3 tables:
- Doors
- UnlockSchedules
- ScheduleActionLog

---

### 4. Test the Application

```bash
# Run the app
dotnet run
```

You should see:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5002
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
```

**Open in browser:** http://localhost:5002

---

### 5. First-Time Setup

1. **Open the calendar:** Click "Open Calendar" button
2. **Sync doors from VIA:** Click "🔄 Sync Doors" button
   - This reads from VIAC database and populates your Doors table
   - Should see: "Doors synced! Added: 58, Updated: 0"
3. **Create a test schedule:**
   - Click any date on calendar
   - Pick a door (test with a safe door first!)
   - Set unlock/lock times
   - Add event name
   - Click "Create Schedule"
4. **Watch the scheduler work:**
   - Background service checks every 30 seconds
   - When unlock time arrives, it calls MonitorCast Quick Controls
   - Check "System Health" in sidebar for status

---

### 6. Testing MonitorCast Integration

**Test a door immediately (without scheduler):**

```bash
# Using curl or Postman
curl -X POST http://localhost:5002/api/doors/{doorId}/test-quick-controls \
  -H "Content-Type: application/json" \
  -d '{"unlock": true}'
```

Or use the Swagger UI: http://localhost:5002/swagger

---

### 7. Run as Windows Service (Production)

Once testing is complete, run as a service so it starts automatically:

```bash
# Publish the app
dotnet publish -c Release -o C:\Services\FBCADoorControl

# Install as Windows Service using NSSM or sc.exe
sc create FBCADoorControl binPath="C:\Services\FBCADoorControl\FBCADoorControl.exe"
sc start FBCADoorControl
```

Or use **NSSM** (Non-Sucking Service Manager):
```bash
nssm install FBCADoorControl "C:\Program Files\dotnet\dotnet.exe" "C:\Services\FBCADoorControl\FBCADoorControl.dll"
nssm start FBCADoorControl
```

---

## Firewall Configuration

If you want to access from other machines:

1. Open Windows Firewall
2. Add inbound rule for port 5002
3. Change `Program.cs` to listen on all interfaces:
   ```csharp
   builder.WebHost.UseUrls("http://0.0.0.0:5002");
   ```

Then access from any machine: http://10.5.5.31:5002

---

## Troubleshooting

**Database connection fails:**
- Check SQL Server name: `Server=FBCA-SQL` or use `localhost` or `10.5.5.31`
- Verify Trusted_Connection (Windows auth) works
- Test connection string manually

**MonitorCast connection fails:**
- Verify MonitorCast is running on port 8080
- Check username/password in appsettings.json
- Test manually: http://localhost:8080

**Scheduler not executing:**
- Check logs in console output
- Verify system time is correct
- Check ScheduleActionLog table for error messages

**Doors not syncing from VIA:**
- Verify VIAC database connection string
- Check VIA database has Doors table
- Verify user has read permission on VIAC database

---

## Monitoring

**Check system health:** http://localhost:5002/api/health

**View recent actions:** http://localhost:5002/api/health/schedule-actions

**Check logs:** Console output shows all activity

---

## Next Steps After Deployment

1. ✅ Sync doors from VIA database
2. ✅ Create test schedule for non-critical door
3. ✅ Wait for scheduler to execute
4. ✅ Verify door actually unlocked/locked
5. ✅ Check audit log (ScheduleActionLog table)
6. ✅ Create real schedules for production use

---

**Support:** If issues, check DEVLOG.md and ARCHITECTURE.md for technical details.

**Phase 3 (Future):** Planning Center Online integration to auto-create schedules from events.
