-- Migration: Add Priority column to UnlockSchedules
-- Date: 2026-02-12
-- Purpose: Implement schedule priority system to prevent Card/Pin schedules from overriding unlocks

USE FBCADoorControl;
GO

-- Add Priority column with default value of 5 (normal priority)
ALTER TABLE UnlockSchedules 
ADD Priority INT NOT NULL DEFAULT 5;
GO

-- Update existing schedules to use default priority
-- (This is redundant since DEFAULT handles it, but explicit for clarity)
UPDATE UnlockSchedules 
SET Priority = 5 
WHERE Priority IS NULL OR Priority = 0;
GO

PRINT 'Migration complete! Priority column added to UnlockSchedules.';
PRINT 'Priority levels: 1 (Card/Pin), 5 (Normal), 10 (Emergency)';
GO
