-- Cleanup Script: Remove partial migration from failed attempts
-- Run this FIRST before running the fixed migration

-- Drop tables in reverse order (respect foreign keys)
IF OBJECT_ID('RecurrenceInstances', 'U') IS NOT NULL
BEGIN
    -- Drop index on IsRecurring if it exists
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UnlockSchedules_Recurring' AND object_id = OBJECT_ID('UnlockSchedules'))
    BEGIN
        DROP INDEX IX_UnlockSchedules_Recurring ON UnlockSchedules;
        PRINT 'Dropped index IX_UnlockSchedules_Recurring';
    END
    
    -- Drop default constraint on IsRecurring if it exists
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name 
    FROM sys.default_constraints 
    WHERE parent_object_id = OBJECT_ID('UnlockSchedules') 
    AND parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('UnlockSchedules') AND name = 'IsRecurring');
    
    IF @ConstraintName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE UnlockSchedules DROP CONSTRAINT ' + @ConstraintName);
        PRINT 'Dropped default constraint ' + @ConstraintName;
    END
    
    -- Remove columns from UnlockSchedules if they exist
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UnlockSchedules') AND name = 'RecurrenceInstanceId')
    BEGIN
        ALTER TABLE UnlockSchedules DROP COLUMN RecurrenceInstanceId;
        PRINT 'Dropped column RecurrenceInstanceId';
    END
    
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UnlockSchedules') AND name = 'IsRecurring')
    BEGIN
        ALTER TABLE UnlockSchedules DROP COLUMN IsRecurring;
        PRINT 'Dropped column IsRecurring';
    END
    
    -- Drop tables
    DROP TABLE RecurrenceInstances;
    PRINT 'Dropped RecurrenceInstances table';
END

IF OBJECT_ID('RecurrencePatternDoors', 'U') IS NOT NULL
BEGIN
    DROP TABLE RecurrencePatternDoors;
    PRINT 'Dropped RecurrencePatternDoors table';
END

IF OBJECT_ID('RecurrencePatterns', 'U') IS NOT NULL
BEGIN
    DROP TABLE RecurrencePatterns;
    PRINT 'Dropped RecurrencePatterns table';
END

PRINT '';
PRINT '✅ Cleanup complete! Now run 003_RecurringSchedules_Fixed.sql';
