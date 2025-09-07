-- Add functions to handle past appointment restrictions
-- Date: 2025-09-07
-- Prevents editing of past appointments

-- Function to check if an appointment is editable (not in the past)
CREATE OR REPLACE FUNCTION is_appointment_editable(appointment_id uuid)
RETURNS boolean AS $$
DECLARE
  appointment_date date;
BEGIN
  SELECT (appointment_datetime::date) INTO appointment_date
  FROM appointments
  WHERE id = appointment_id;
  
  -- Appointments from previous dates cannot be edited
  RETURN appointment_date >= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Add a trigger to prevent updates to past appointments (except status changes and time tracking fields)
CREATE OR REPLACE FUNCTION prevent_past_appointment_edits()
RETURNS trigger AS $$
BEGIN
  -- Allow updates if it's the same day or future
  IF (OLD.appointment_datetime::date) >= CURRENT_DATE THEN
    RETURN NEW;
  END IF;
  
  -- For past appointments, allow status changes and time tracking fields
  IF (OLD.appointment_datetime::date) < CURRENT_DATE THEN
    -- Allow status updates and time tracking fields for past appointments
    IF NEW.status IN ('Completed', 'Cancelled', 'No-Show', 'Checked-In', 'In-Progress') AND 
       OLD.appointment_datetime = NEW.appointment_datetime AND
       OLD.patient_id = NEW.patient_id AND
       OLD.doctor_id = NEW.doctor_id THEN
      -- Allow updates to status and time tracking fields only
      NEW.patient_id = OLD.patient_id;
      NEW.doctor_id = OLD.doctor_id;
      NEW.appointment_datetime = OLD.appointment_datetime;
      NEW.duration_minutes = OLD.duration_minutes;
      NEW.appointment_type = OLD.appointment_type;
      NEW.symptoms = OLD.symptoms;
      NEW.created_at = OLD.created_at;
      -- Allow status, notes, diagnosis, prescription, and time tracking fields to be updated
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Cannot edit core appointment details from previous dates. Only status updates and completion details are allowed.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_past_appointment_edits_trigger ON appointments;
CREATE TRIGGER prevent_past_appointment_edits_trigger
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_past_appointment_edits();

COMMENT ON FUNCTION is_appointment_editable(uuid) IS 'Checks if an appointment can be edited (not from past dates)';
COMMENT ON FUNCTION prevent_past_appointment_edits() IS 'Prevents editing of past appointments except for status updates';
