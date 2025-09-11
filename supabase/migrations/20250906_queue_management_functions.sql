-- Complete Queue Management Functions
-- Add these to your Supabase SQL editor

-- Function to handle doctor delays (shift all pending appointments)
CREATE OR REPLACE FUNCTION add_doctor_delay(
  p_doctor_id UUID,
  p_service_date DATE,
  p_delay_minutes INTEGER
) RETURNS JSONB AS $$
DECLARE
  affected_count INTEGER := 0;
BEGIN
  -- Update all pending appointments with delay
  UPDATE appointments 
  SET 
    estimated_start_time = COALESCE(estimated_start_time, appointment_datetime) + (p_delay_minutes * INTERVAL '1 minute'),
    appointment_datetime = appointment_datetime + (p_delay_minutes * INTERVAL '1 minute'),
    updated_at = NOW()
  WHERE doctor_id = p_doctor_id 
    AND appointment_datetime::date = p_service_date
    AND status NOT IN ('completed', 'cancelled', 'no-show');
    
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true, 
    'affected_appointments', affected_count,
    'delay_minutes', p_delay_minutes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to recalculate queue positions for a doctor/date
CREATE OR REPLACE FUNCTION recalculate_queue_positions(
  p_doctor_id UUID,
  p_service_date DATE
) RETURNS JSONB AS $$
DECLARE
  affected_count INTEGER := 0;
BEGIN
  -- Recalculate queue positions based on appointment time
  WITH numbered_appointments AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY appointment_datetime ASC) as new_position
    FROM appointments 
    WHERE doctor_id = p_doctor_id 
      AND appointment_datetime::date = p_service_date
      AND status NOT IN ('cancelled', 'no-show', 'completed')
  )
  UPDATE appointments 
  SET 
    queue_position = numbered_appointments.new_position,
    updated_at = NOW()
  FROM numbered_appointments 
  WHERE appointments.id = numbered_appointments.id;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Calculate estimated start times
  PERFORM calculate_estimated_start_times(p_doctor_id, p_service_date);
  
  RETURN jsonb_build_object(
    'success', true, 
    'recalculated_appointments', affected_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate estimated start times
CREATE OR REPLACE FUNCTION calculate_estimated_start_times(
  p_doctor_id UUID,
  p_service_date DATE
) RETURNS VOID AS $$
DECLARE
  current_time TIMESTAMPTZ;
  appointment_record RECORD;
  running_time TIMESTAMPTZ;
BEGIN
  -- Start from current time or first appointment time
  SELECT GREATEST(NOW(), MIN(appointment_datetime))
  INTO current_time
  FROM appointments 
  WHERE doctor_id = p_doctor_id 
    AND appointment_datetime::date = p_service_date
    AND status NOT IN ('cancelled', 'no-show', 'completed');
  
  running_time := current_time;
  
  -- Update estimated times for each appointment in queue order
  FOR appointment_record IN
    SELECT id, duration_minutes, queue_position
    FROM appointments 
    WHERE doctor_id = p_doctor_id 
      AND appointment_datetime::date = p_service_date
      AND status NOT IN ('cancelled', 'no-show', 'completed')
    ORDER BY queue_position ASC NULLS LAST
  LOOP
    -- Update estimated start time
    UPDATE appointments 
    SET estimated_start_time = running_time
    WHERE id = appointment_record.id;
    
    -- Add appointment duration plus 10-minute buffer
    running_time := running_time + (COALESCE(appointment_record.duration_minutes, 30) + 10) * INTERVAL '1 minute';
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically assign queue position on insert
CREATE OR REPLACE FUNCTION auto_assign_queue_position()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-assign queue position if not provided
  IF NEW.queue_position IS NULL THEN
    SELECT COALESCE(MAX(queue_position), 0) + 1 
    INTO NEW.queue_position
    FROM appointments 
    WHERE doctor_id = NEW.doctor_id 
      AND appointment_datetime::date = NEW.appointment_datetime::date
      AND status NOT IN ('cancelled', 'no-show', 'completed');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for emergency appointment insertion (goes to front of queue)
CREATE OR REPLACE FUNCTION insert_emergency_appointment(
  p_user_id UUID,
  p_patient_id UUID,
  p_doctor_id UUID,
  p_appointment_datetime TIMESTAMPTZ,
  p_duration_minutes INTEGER DEFAULT 30,
  p_symptoms TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  new_appointment_id UUID;
BEGIN
  -- Insert emergency appointment with queue position 1
  INSERT INTO appointments (
    user_id,
    patient_id, 
    doctor_id,
    appointment_datetime,
    duration_minutes,
    symptoms,
    status,
    queue_position,
    estimated_start_time
  ) VALUES (
    p_user_id,
    p_patient_id,
    p_doctor_id, 
    p_appointment_datetime,
    p_duration_minutes,
    p_symptoms,
    'scheduled',
    1,
    NOW()
  ) RETURNING id INTO new_appointment_id;
  
  -- Shift all other appointments down
  UPDATE appointments 
  SET queue_position = queue_position + 1
  WHERE doctor_id = p_doctor_id 
    AND appointment_datetime::date = p_appointment_datetime::date
    AND id != new_appointment_id
    AND status NOT IN ('cancelled', 'no-show', 'completed');
  
  -- Recalculate estimated times
  PERFORM calculate_estimated_start_times(p_doctor_id, p_appointment_datetime::date);
  
  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', new_appointment_id,
    'message', 'Emergency appointment inserted at front of queue'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic queue management
DROP TRIGGER IF EXISTS assign_queue_position_trigger ON appointments;
CREATE TRIGGER assign_queue_position_trigger
  BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION auto_assign_queue_position();

-- Trigger to recalculate queue when appointments change
CREATE OR REPLACE FUNCTION trigger_queue_recalculation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate for non-completed appointments
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM recalculate_queue_positions(NEW.doctor_id, NEW.appointment_datetime::date);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM recalculate_queue_positions(OLD.doctor_id, OLD.appointment_datetime::date);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS queue_recalculation_trigger ON appointments;
CREATE TRIGGER queue_recalculation_trigger
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_queue_recalculation();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_doctor_delay TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_queue_positions TO authenticated;
GRANT EXECUTE ON FUNCTION insert_emergency_appointment TO authenticated;
