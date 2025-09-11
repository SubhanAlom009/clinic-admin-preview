-- Add delay_minutes field and auto-cancellation logic
-- Date: 2025-09-07
-- Adds delay_minutes field and function to auto-cancel no-show appointments

-- Add delay_minutes field to appointments table
ALTER TABLE IF EXISTS appointments
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 0;

-- Function to auto-cancel no-show appointments after 20 minutes
CREATE OR REPLACE FUNCTION auto_cancel_no_show_appointments()
RETURNS void AS $$
BEGIN
  -- Update appointments that are 20+ minutes past their scheduled time and still 'Scheduled'
  UPDATE appointments 
  SET 
    status = 'No-Show',
    updated_at = now(),
    notes = COALESCE(notes, '') || 
      CASE 
        WHEN notes IS NULL OR notes = '' THEN 'Auto-cancelled: Patient did not show up within 20 minutes of scheduled time'
        ELSE '. Auto-cancelled: Patient did not show up within 20 minutes of scheduled time'
      END
  WHERE 
    status = 'Scheduled' 
    AND appointment_datetime < (now() - INTERVAL '20 minutes')
    AND service_day <= CURRENT_DATE;
    
  -- Log the count of cancelled appointments
  RAISE NOTICE 'Auto-cancelled % no-show appointments', 
    (SELECT COUNT(*) FROM appointments WHERE status = 'No-Show' AND updated_at > (now() - INTERVAL '1 minute'));
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run every 10 minutes (requires pg_cron extension)
-- Note: This would need to be set up separately in production with pg_cron
-- For now, this can be called manually or via application logic

COMMENT ON FUNCTION auto_cancel_no_show_appointments() IS 'Auto-cancels appointments where patients did not show up within 20 minutes of scheduled time';
