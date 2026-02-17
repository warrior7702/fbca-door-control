-- Test Script: Create FLX Sunday Morning Recurring Schedule
-- This will auto-generate 4 Sunday schedules (next 4 weeks)

-- Find FLX door
DECLARE @FLXDoorID INT;
SELECT @FLXDoorID = DoorID 
FROM Doors 
WHERE DoorName LIKE '%FLX%';

IF @FLXDoorID IS NULL
BEGIN
    PRINT 'ERROR: FLX door not found!';
    PRINT 'Available doors with FLX in name:';
    SELECT DoorID, DoorName FROM Doors WHERE DoorName LIKE '%FLX%';
    RETURN;
END

PRINT 'Found FLX door: ID = ' + CAST(@FLXDoorID AS VARCHAR(10));

-- Create recurring pattern
DECLARE @PatternID INT;

INSERT INTO RecurrencePatterns (
    EventName,
    Description,
    UnlockTime,
    LockTime,
    RecurrenceType,
    DayOfWeek,
    StartDate,
    GenerateWeeksAhead,
    IsActive,
    CreatedBy
)
VALUES (
    'Sunday Morning Gym',
    'FLX gym area open for Sunday morning activities',
    '08:00:00',  -- 8:00 AM
    '12:00:00',  -- 12:00 PM
    'Weekly',
    0,           -- 0 = Sunday
    '2026-02-23', -- This coming Sunday
    4,           -- Generate 4 weeks ahead
    1,           -- Active
    'TestScript'
);

SET @PatternID = SCOPE_IDENTITY();

PRINT 'Created recurring pattern: ID = ' + CAST(@PatternID AS VARCHAR(10));

-- Link pattern to FLX door
INSERT INTO RecurrencePatternDoors (
    RecurrencePatternId,
    DoorID
)
VALUES (
    @PatternID,
    @FLXDoorID
);

PRINT 'Linked pattern to FLX door';

-- Verify the pattern was created
PRINT '';
PRINT '=== Recurring Pattern Created ===';
SELECT 
    Id,
    EventName,
    CONVERT(VARCHAR(5), UnlockTime, 108) AS UnlockTime,
    CONVERT(VARCHAR(5), LockTime, 108) AS LockTime,
    RecurrenceType,
    CASE DayOfWeek 
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END AS DayOfWeek,
    StartDate,
    GenerateWeeksAhead,
    IsActive
FROM RecurrencePatterns
WHERE Id = @PatternID;

PRINT '';
PRINT '=== Linked Doors ===';
SELECT 
    rpd.Id,
    d.DoorName,
    d.DoorID
FROM RecurrencePatternDoors rpd
JOIN Doors d ON rpd.DoorID = d.DoorID
WHERE rpd.RecurrencePatternId = @PatternID;

PRINT '';
PRINT '✅ SUCCESS! Recurring pattern created.';
PRINT '';
PRINT 'NEXT STEPS:';
PRINT '1. Restart the door control service (or wait for next daily check)';
PRINT '2. Service will auto-generate 4 Sunday schedules';
PRINT '3. Check UnlockSchedules table to see generated instances';
PRINT '4. Check calendar UI - you should see 4 Sundays with "Sunday Morning Gym"';
PRINT '';
PRINT 'To manually trigger generation NOW (for testing):';
PRINT 'Restart the service - it will check on startup.';
