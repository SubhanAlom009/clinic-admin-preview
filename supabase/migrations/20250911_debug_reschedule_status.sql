-- Debug and fix reschedule status issue
-- Date: 2025-09-11
-- This migration ensures that rescheduled appointments maintain correct status

-- Add logging function for debugging appointment status changes
CREATE OR REPLACE FUNCTION log_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes for debugging
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) VALUES (
      NEW.user_id,
      'status_change',
      'appointments',
      NEW.id::text,
      jsonb_build_object('old_status', OLD.status, 'old_datetime', OLD.appointment_datetime),
      jsonb_build_object('new_status', NEW.status, 'new_datetime', NEW.appointment_datetime)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status change logging (only if audit_logs table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    DROP TRIGGER IF EXISTS log_appointment_status_changes ON appointments;
    CREATE TRIGGER log_appointment_status_changes
      AFTER UPDATE ON appointments
      FOR EACH ROW
      EXECUTE FUNCTION log_appointment_status_change();
  END IF;
END $$;

-- Ensure all rescheduled appointments that should be scheduled are set correctly
-- This is a one-time fix for any existing data issues
UPDATE appointments 
SET status = 'scheduled' 
WHERE status = 'rescheduled' 
  AND appointment_datetime > NOW();

-- Add a comment to help with debugging
COMMENT ON TRIGGER log_appointment_status_changes ON appointments IS 'Logs appointment status changes for debugging reschedule issues';
