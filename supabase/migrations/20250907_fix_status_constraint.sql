-- Fix appointment status constraint to match the updated enum values
-- Date: 2025-09-07

-- Normalize existing status values to lowercase canonical forms
UPDATE appointments SET status = lower(status);

-- Map common uppercase/variant forms to canonical lowercase values
UPDATE appointments SET status = 'scheduled' WHERE status IN ('scheduled', 'scheduled');
UPDATE appointments SET status = 'checked-in' WHERE status IN ('checked-in', 'checkedin', 'checked_in', 'CHECKED_IN');
UPDATE appointments SET status = 'in-progress' WHERE status IN ('in-progress', 'inprogress', 'IN_PROGRESS');
UPDATE appointments SET status = 'completed' WHERE status IN ('completed', 'COMPLETED');
UPDATE appointments SET status = 'cancelled' WHERE status IN ('cancelled', 'CANCELLED');
UPDATE appointments SET status = 'no-show' WHERE status IN ('no-show', 'NOSHOW', 'NO_SHOW');
UPDATE appointments SET status = 'rescheduled' WHERE status IN ('rescheduled', 'RESCHEDULED');

-- Drop the existing constraint (if any) and add a lowercase constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('scheduled','checked-in','in-progress','completed','cancelled','no-show','rescheduled'));
