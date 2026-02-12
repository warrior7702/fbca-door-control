# Quick Deploy Checklist - FBCA Door Control Bug Fixes

## Files Changed (Copy These to Windows Server)
1. ✅ `Data/VIACDbContext.cs` - Fixed HasKey/HasNoKey conflict
2. ✅ `Services/SchedulerService.cs` - Fixed LINQ translation error  
3. ✅ `Services/QuickControlsService.cs` - Added MonitorCast testing notes

## Pre-Deployment
- [ ] **BACKUP** current production code
- [ ] Copy 3 files above to Windows server
- [ ] Run `dotnet build` on Windows (must succeed)

## Deployment
- [ ] Stop Door Control service
- [ ] Deploy new build
- [ ] Start Door Control service

## Post-Deployment Testing (15 minutes)

### Immediate (0-2 min)
- [ ] Service starts without errors
- [ ] Check logs for "Scheduler service starting"
- [ ] NO errors about "HasNoKey" or "HasKey"
- [ ] NO errors about "LINQ query can't translate"

### MonitorCast Auth (2-5 min)
- [ ] MonitorCast service is running
- [ ] Check logs for "Authenticating to MonitorCast"
- [ ] Should see "authentication successful"
- [ ] Should NOT see 404 on /Account/Login

### Functional Test (5-10 min)
- [ ] Open web interface
- [ ] Manually unlock a test door
- [ ] Check database - ScheduleActionLog entry created
- [ ] Manually lock the door
- [ ] Check logs - no errors

### Scheduler Test (10-15 min)
- [ ] Wait for next schedule check (30 sec intervals)
- [ ] Logs show "Checking schedules at..."
- [ ] If due schedules exist, they execute
- [ ] Check ScheduleActionLog table for new entries

## If Anything Fails
1. **STOP** - Don't proceed
2. Check Windows Event Viewer
3. Review application logs
4. Consider rollback
5. Contact Billy with error details

## Success Indicators
✅ Service running  
✅ No HasKey errors  
✅ No LINQ translation errors  
✅ MonitorCast auth succeeds (200 OK)  
✅ Manual door unlock/lock works  
✅ Scheduled actions execute  

## Full Details
See: `BUG_FIXES_SUMMARY.md`
