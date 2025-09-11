-- Fix the trigger to allow time tracking fields for status updates
-- Date: 2025-09-07
-- Allows status updates with time tracking fields for today's appointments

CREATE OR REPLACE FUNCTION prevent_past_appointment_edits()
RETURNS trigger AS $$
BEGIN
  -- Allow all updates if it's the same day or future (use appointment_datetime date)
  IF (OLD.appointment_datetime::date) >= CURRENT_DATE THEN
    RETURN NEW;
  END IF;
  
  -- For past appointments, be more permissive with status changes and time tracking
  IF (OLD.appointment_datetime::date) < CURRENT_DATE THEN
    -- Allow status updates with time tracking fields
    IF NEW.status IN ('Completed', 'Cancelled', 'No-Show', 'Checked-In', 'In-Progress') THEN
      -- Preserve core appointment details that shouldn't change
      NEW.patient_id = OLD.patient_id;
      NEW.doctor_id = OLD.doctor_id;
      NEW.appointment_datetime = OLD.appointment_datetime;
      NEW.duration_minutes = OLD.duration_minutes;
      NEW.appointment_type = OLD.appointment_type;
      NEW.created_at = OLD.created_at;
      
      -- Allow status, time tracking, and medical fields to be updated
      -- (status, actual_start_time, actual_end_time, checked_in_at, patient_checked_in, 
      --  diagnosis, prescription, notes, updated_at are allowed to change)
      
  RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Cannot edit core details of past appointments. Only status updates are allowed.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
