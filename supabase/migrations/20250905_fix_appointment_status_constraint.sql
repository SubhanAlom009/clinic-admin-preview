-- Fix appointment status constraint to ensure correct values
-- This migration ensures the status constraint matches our application constants

-- First, let's drop any existing constraint that might be wrong
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

-- Add the correct constraint with the exact values our application uses
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('Scheduled', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show', 'Rescheduled'));

-- Verify the constraint exists
-- You can run this to check: SELECT conname, consrc FROM pg_constraint WHERE conrelid = 'appointments'::regclass AND conname = 'appointments_status_check';
