-- Add emergency status fields to appointments table
ALTER TABLE appointments 
ADD COLUMN emergency_status BOOLEAN DEFAULT FALSE,
ADD COLUMN emergency_reason TEXT;

-- Update existing emergency appointments (if any exist with emergency notes)
UPDATE appointments 
SET emergency_status = TRUE,
    emergency_reason = 'Emergency appointment'
WHERE notes ILIKE '%emergency%' OR symptoms ILIKE '%emergency%';

-- Create index for better performance on emergency queries
CREATE INDEX idx_appointments_emergency_status ON appointments(emergency_status);
CREATE INDEX idx_appointments_queue_position ON appointments(queue_position);

-- Add comment for documentation
COMMENT ON COLUMN appointments.emergency_status IS 'Indicates if this is an emergency appointment';
COMMENT ON COLUMN appointments.emergency_reason IS 'Reason for emergency classification';
