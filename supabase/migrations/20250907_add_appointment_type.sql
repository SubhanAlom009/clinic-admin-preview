-- Add appointment_type column to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS appointment_type text DEFAULT 'Consultation';

-- Update existing appointments to have a default type
UPDATE appointments 
SET appointment_type = 'Consultation' 
WHERE appointment_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN appointments.appointment_type IS 'Type of appointment: Consultation, Follow-up, Emergency, etc.';
