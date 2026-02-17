-- Migration: Recurring Schedules Support
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
    DayOfWeek INT NULL CHECK (DayOfWeek BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday (for Weekly/BiWeekly)
    DayOfMonth INT NULL CHECK (DayOfMonth BETWEEN 1 AND 31), -- 1-31 (for Monthly)
    WeekInterval INT NULL DEFAULT 1, -- For BiWeekly: 2, else 1
    
    -- Active Period
    StartDate DATE NOT NULL,
    EndDate DATE NULL, -- NULL = indefinite
    
    -- Generation Settings
    GenerateWeeksAhead INT NOT NULL DEFAULT 4, -- How many weeks to generate in advance
    
    -- Status
    IsActive BIT NOT NULL DEFAULT 1,
    
    -- Audit Fields
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NULL,
    ModifiedAt DATETIME2 NULL,
    ModifiedBy NVARCHAR(100) NULL,
    
    -- Indexes
    INDEX IX_RecurrencePatterns_Active (IsActive, StartDate) WHERE IsActive = 1,
    INDEX IX_RecurrencePatterns_Type (RecurrenceType)
);

-- ============================================
-- 2. RECURRENCE PATTERN DOORS (Link Table)
-- ============================================

CREATE TABLE RecurrencePatternDoors (
    Id INT PRIMARY KEY IDENTITY(1,1),
    RecurrencePatternId INT NOT NULL,
    DoorId INT NOT NULL,
    
    -- Optional per-door time overrides
    CustomUnlockTime TIME NULL,
    CustomLockTime TIME NULL,
    
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    FOREIGN KEY (RecurrencePatternId) REFERENCES RecurrencePatterns(Id) ON DELETE CASCADE,
    FOREIGN KEY (DoorId) REFERENCES Doors(DoorId),
    
    -- Prevent duplicate door assignments
    CONSTRAINT UQ_RecurrencePatternDoors UNIQUE (RecurrencePatternId, DoorId),
    
    INDEX IX_RecurrencePatternDoors_Pattern (RecurrencePatternId),
    INDEX IX_RecurrencePatternDoors_Door (DoorId)
);

-- ============================================
-- 3. RECURRENCE INSTANCES (Tracking Generated Schedules)
-- ============================================

CREATE TABLE RecurrenceInstances (
    Id INT PRIMARY KEY IDENTITY(1,1),
    RecurrencePatternId INT NOT NULL,
    ScheduleId INT NOT NULL, -- Links to UnlockSchedules.Id
    ScheduledDate DATE NOT NULL,
    GeneratedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    FOREIGN KEY (RecurrencePatternId) REFERENCES RecurrencePatterns(Id) ON DELETE CASCADE,
    FOREIGN KEY (ScheduleId) REFERENCES UnlockSchedules(Id) ON DELETE CASCADE,
    
    -- Prevent duplicate instance generation
    CONSTRAINT UQ_RecurrenceInstances UNIQUE (RecurrencePatternId, ScheduledDate, ScheduleId),
    
    INDEX IX_RecurrenceInstances_Pattern (RecurrencePatternId),
    INDEX IX_RecurrenceInstances_Date (ScheduledDate)
);

-- ============================================
-- 4. ADD RECURRENCE TRACKING TO EXISTING TABLE
-- ============================================

-- Add column to track if a schedule was auto-generated
ALTER TABLE UnlockSchedules
ADD IsRecurring BIT NOT NULL DEFAULT 0,
    RecurrenceInstanceId INT NULL;

-- Add foreign key after column creation
ALTER TABLE UnlockSchedules
ADD CONSTRAINT FK_UnlockSchedules_RecurrenceInstance
    FOREIGN KEY (RecurrenceInstanceId) REFERENCES RecurrenceInstances(Id) ON DELETE SET NULL;

CREATE INDEX IX_UnlockSchedules_Recurring ON UnlockSchedules(IsRecurring) WHERE IsRecurring = 1;

-- ============================================
-- 5. SAMPLE DATA (For Testing)
-- ============================================

-- Example: Sunday Morning Service (Every Sunday 8:00 AM - 12:00 PM)
-- Uncomment to insert test data:

/*
DECLARE @PatternId INT;

INSERT INTO RecurrencePatterns (EventName, Description, UnlockTime, LockTime, RecurrenceType, DayOfWeek, StartDate, GenerateWeeksAhead, CreatedBy)
VALUES ('Sunday Morning Service', 'Weekly Sunday service doors', '08:00:00', '12:00:00', 'Weekly', 0, CAST(GETDATE() AS DATE), 4, 'system');

SET @PatternId = SCOPE_IDENTITY();

-- Link to Main Church and PCB doors (example)
INSERT INTO RecurrencePatternDoors (RecurrencePatternId, DoorId)
SELECT @PatternId, DoorId 
FROM Doors 
WHERE DoorName IN ('Main Church', 'PCB Main Entrance');
*/

PRINT 'Migration 003_RecurringSchedules completed successfully!';
