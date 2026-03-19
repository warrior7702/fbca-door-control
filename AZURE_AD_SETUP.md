# Azure AD + Recurring Schedules Setup

## Azure AD Configuration ✅ DONE

**App Registration:**
- Name: FBCA Door Control
- Client ID: `6b005bfe-14e7-4cc8-92d2-8719baf8e12d`
- Tenant ID: `eef47b51-2c23-430e-be99-c21dc7f87323`
- Client Secret: `hhu8Q~XnLZ6yVWWWheQwUcspSa02wSiPqiemaLaFX`
- Expires: August 15, 2026 (6 months)
- Redirect URI: `http://localhost:5002/signin-oidc`

**Stored in:** `appsettings.AzureAD.json` (NOT committed to git)

---

## Step 1: Run Database Migration

**On production server (10.5.5.31):**

```powershell
# Open SQL Server Management Studio or run via sqlcmd
# Execute: Migrations/003_RecurringSchedules.sql

sqlcmd -S localhost -d FBCADoorControl -i "C:\path\to\Migrations\003_RecurringSchedules.sql"
```

**Or manually in SSMS:**
1. Open `Migrations/003_RecurringSchedules.sql`
2. Execute against `FBCADoorControl` database
3. Verify tables created: `RecurrencePatterns`, `RecurrencePatternDoors`, `RecurrenceInstances`

---

## Step 2: Update NuGet Packages (Needed for Azure AD)

**Add to project:**
```powershell
dotnet add package Microsoft.Identity.Web
dotnet add package Microsoft.Identity.Web.UI
```

---

## Step 3: Copy Configuration File

**On server:**
```powershell
# Copy appsettings.AzureAD.json to server
# Place alongside appsettings.json
```

---

## Step 4: Add Redirect URI for Production

**After getting production URL (Tailscale or doors.fbca.org):**

1. Go to Azure Portal → App Registrations → FBCA Door Control
2. Click "Authentication" → "Add a platform" → Web
3. Add redirect URI: `https://100.123.239.124:5002/signin-oidc` (Tailscale)
4. Or: `https://doors.fbca.org/signin-oidc` (when domain is ready)

---

## Step 5: Assign User Roles

**Update `appsettings.AzureAD.json` with real emails:**

```json
"Authorization": {
  "Roles": {
    "Admin": [
      "billy.nelms@fbca.org",  // Replace with your real email
      "admin@fbca.org"
    ],
    "Viewer": [
      "staff@fbca.org"
    ]
  }
}
```

**Admin = Full access (create/edit/delete schedules, unlock doors)**  
**Viewer = Read-only (view schedules, view camera feeds)**

---

## Next Steps

1. ✅ Migration SQL created
2. 🔄 Working on: C# code (models, services, auth middleware)
3. 📝 TODO: Update UI to add recurring schedule creation
4. 🧪 TODO: Test with FLX door (Sunday morning test)

---

## Testing Plan

**Phase 1: Database Test**
- Run migration
- Manually insert test recurring pattern (FLX Sunday 8 AM-12 PM)
- Verify RecurrenceInstances generates 4 weeks of schedules

**Phase 2: Auth Test**
- Deploy updated code with Azure AD
- Login with your FBCA email
- Verify Admin role assigned

**Phase 3: UI Test**
- Create recurring schedule via UI
- Verify appears on calendar (4 weeks ahead)
- Wait for Sunday, confirm door unlocks automatically

---

**Current Status:** Migration ready, working on C# implementation
