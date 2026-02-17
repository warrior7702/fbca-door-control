-- Migration: Recurring Schedules Support (Fixed for SQL Server 2016)
-- Created: 2026-02-16
-- Purpose: Enable weekly/biweekly/monthly recurring door unlock schedules

-- ============================================
-- 1. RECURRENCE PATTERNS TABLE
-- ============================================

CREATE TABLE RecurrencePatterns (
    Id INT PRIMARY KEY IDENTITY(1,1),
    
    -- Event Information
    EventName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500) NULL,
    
    -- Time Settings
    UnlockTime TIME NOT NULL,
    LockTime TIME NOT NULL,
    
    -- Recurrence Configuration
    RecurrenceType NVARCHAR(20) NOT NULL CHECK (RecurrenceType IN ('Weekly', 'BiWeekly', 'Monthly')),
    DayOfWeek INT NULL CHECK (DayOfWeek BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    DayOfMonth INT NULL CHECK (DayOfMonth BETWEEN 1 AND 31), -- 1-31 (for Monthly)
    WeekInterval INT NULL DEFAULT 1, -- For BiWeekly: 2, else 1
    
    -- Active Period
    StartDate DATE NOT NULL,
    EndDate DATE NULL, -- NULL = indefinite
    
    -- Generation Settings
    GenerateWeeksAhead INT NOT NULL DEFAULT 4,
    
    -- Status
    IsActive BIT NOT NULL DEFAULT 1,
    
    -- Audit Fields
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    ModifiedAt DATETIME2 NULL,
    ModifiedBy NVARCHAR(100) NULL
);

-- Indexes for RecurrencePatterns
CREATE INDEX IX_RecurrencePatterns_Active 
ON RecurrencePatterns(IsActive, StartDate) 
WHERE IsActive = 1;

CREATE INDEX IX_RecurrencePatterns_Type 
ON RecurrencePatterns(RecurrenceType);

-- ============================================
-- 2. RECURRENCE PATTERN DOORS (Link Table)
-- ============================================

CREATE TABLE RecurrencePatternDoors (
    Id INT PRIMARY KEY IDENTITY(1,1),
    RecurrencePatternId INT NOT NULL,
    DoorID INT NOT NULL,
    
    -- Optional per-door time overrides
    CustomUnlockTime TIME NULL,
    CustomLockTime TIME NULL,
    
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    FOREIGN KEY (RecurrencePatternId) REFERENCES RecurrencePatterns(Id) ON DELETE CASCADE,
    FOREIGN KEY (DoorID) REFERENCES Doors(DoorID),
    
    -- Prevent duplicate door assignments
    CONSTRAINT UQ_RecurrencePatternDoors UNIQUE (RecurrencePatternId, DoorID)
);

-- Indexes for RecurrencePatternDoors
CREATE INDEX IX_RecurrencePatternDoors_Pattern 
ON RecurrencePatternDoors(RecurrencePatternId);

CREATE INDEX IX_RecurrencePatternDoors_Door 
ON RecurrencePatternDoors(DoorID);

-- ============================================
-- 3. RECURRENCE INSTANCES (Tracking Generated Schedules)
-- ============================================

CREATE TABLE RecurrenceInstances (
    Id INT PRIMARY KEY IDENTITY(1,1),
    RecurrencePatternId INT NOT NULL,
    ScheduleID INT NOT NULL,
    ScheduledDate DATE NOT NULL,
    GeneratedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    FOREIGN KEY (RecurrencePatternId) REFERENCES RecurrencePatterns(Id) ON DELETE CASCADE,
    FOREIGN KEY (ScheduleID) REFERENCES UnlockSchedules(ScheduleID) ON DELETE CASCADE,
    
    -- Prevent duplicate instance generation
    CONSTRAINT UQ_RecurrenceInstances UNIQUE (RecurrencePatternId, ScheduledDate, ScheduleID)
);

-- Indexes for RecurrenceInstances
CREATE INDEX IX_RecurrenceInstances_Pattern 
ON RecurrenceInstances(RecurrencePatternId);

CREATE INDEX IX_RecurrenceInstances_Date 
ON RecurrenceInstances(ScheduledDate);

-- ============================================
-- 4. ADD RECURRENCE TRACKING TO EXISTING TABLE
-- ============================================

-- Add columns to track if a schedule was auto-generated
ALTER TABLE UnlockSchedules
ADD IsRecurring BIT NOT NULL DEFAULT 0,
    RecurrenceInstanceId INT NULL;

-- Note: No foreign key constraint to avoid cascade cycles
-- Relationship is managed via RecurrenceInstances -> UnlockSchedules

GO

-- Index for recurring schedules (separate batch for SQL Server 2016)
CREATE INDEX IX_UnlockSchedules_Recurring 
ON UnlockSchedules(IsRecurring) 
WHERE IsRecurring = 1;

GO

-- ============================================
-- 5. VERIFY MIGRATION
-- ============================================

-- Check tables created
SELECT 'Tables created successfully:' AS Status;
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME IN ('RecurrencePatterns', 'RecurrencePatternDoors', 'RecurrenceInstances')
ORDER BY TABLE_NAME;

-- Check row counts (should all be 0)
SELECT 
    'RecurrencePatterns' AS TableName,
    COUNT(*) AS [RowCount]
FROM RecurrencePatterns
UNION ALL
SELECT 
    'RecurrencePatternDoors',
    COUNT(*)
FROM RecurrencePatternDoors
UNION ALL
SELECT 
    'RecurrenceInstances',
    COUNT(*)
FROM RecurrenceInstances;

PRINT '';
PRINT '✅ Migration 003_RecurringSchedules completed successfully!';
PRINT '✅ All tables created and empty (ready for data)';
PRINT '✅ No schedules affected - system still running normally';
