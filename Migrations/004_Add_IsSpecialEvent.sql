-- Migration 004: Add IsSpecialEvent column to RecurrencePatterns table
-- Date: 2026-03-02
-- Purpose: Support special event flag for recurring schedules

-- Check if column already exists before adding
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE Name = N'IsSpecialEvent' 
    AND Object_ID = Object_ID(N'dbo.RecurrencePatterns')
)
BEGIN
    -- Add IsSpecialEvent column with default value false
    ALTER TABLE RecurrencePatterns
    ADD IsSpecialEvent BIT NOT NULL DEFAULT 0;
    
    PRINT 'Added IsSpecialEvent column to RecurrencePatterns table';
END
ELSE
BEGIN
    PRINT 'IsSpecialEvent column already exists';
END

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'RecurrencePatterns' 
AND COLUMN_NAME = 'IsSpecialEvent';
