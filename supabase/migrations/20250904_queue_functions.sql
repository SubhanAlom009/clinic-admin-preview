/*
# Advanced Queue Management Functions
# Production-grade PostgreSQL functions for appointment scheduling
# Date: 2025-09-04
# Version: 2.0
*/

-- ========================================
-- 1. DISTRIBUTED LOCKING SYSTEM
-- ========================================

CREATE OR REPLACE FUNCTION acquire_queue_lock(
  p_lock_key text,
  p_locked_by text,
  p_timeout_seconds integer DEFAULT 300
) RETURNS boolean AS $$
DECLARE
  lock_acquired boolean := false;
BEGIN
  -- Clean up expired locks first
  DELETE FROM queue_locks WHERE expires_at < now();
  
  -- Try to acquire the lock
  INSERT INTO queue_locks (lock_key, locked_by, expires_at)
  VALUES (p_lock_key, p_locked_by, now() + (p_timeout_seconds || ' seconds')::interval)
  ON CONFLICT (lock_key) DO NOTHING;
  
  -- Check if we got the lock
  GET DIAGNOSTICS lock_acquired = ROW_COUNT;
  RETURN (lock_acquired > 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_queue_lock(
  p_lock_key text,
  p_locked_by text
) RETURNS boolean AS $$
DECLARE
  lock_released boolean := false;
BEGIN
  DELETE FROM queue_locks 
  WHERE lock_key = p_lock_key AND locked_by = p_locked_by;
  
  GET DIAGNOSTICS lock_released = ROW_COUNT;
  RETURN (lock_released > 0);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. QUEUE RECALCULATION FUNCTIONS
-- ========================================

CREATE OR REPLACE FUNCTION recalculate_queue_positions(
  p_doctor_id uuid,
  p_service_day date
) RETURNS json AS $$
DECLARE
  appointment_record RECORD;
  current_position integer := 1;
  current_eta timestamptz;
  clinic_start_time timestamptz;
  total_updated integer := 0;
  lock_key text;
  lock_acquired boolean;
  result json;
BEGIN
  -- Create lock key
  lock_key := 'queue_recalc_' || p_doctor_id::text || '_' || p_service_day::text;
  
  -- Try to acquire lock
  SELECT acquire_queue_lock(lock_key, 'queue_recalculation', 300) INTO lock_acquired;
  
  IF NOT lock_acquired THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Could not acquire lock for queue recalculation',
      'updated_count', 0
    );
  END IF;
  
  BEGIN
    -- Get clinic start time for the day
    SELECT 
      (p_service_day::text || ' ' || MIN(ds.start_time)::text)::timestamptz
    INTO clinic_start_time
    FROM doctor_schedules ds
    WHERE ds.doctor_id = p_doctor_id 
      AND ds.day_of_week = EXTRACT(DOW FROM p_service_day)
      AND ds.is_active = true;
    
    -- If no schedule found, use 9 AM as default
    IF clinic_start_time IS NULL THEN
      clinic_start_time := (p_service_day::text || ' 09:00:00')::timestamptz;
    END IF;
    
    -- Initialize ETA to clinic start time
    current_eta := clinic_start_time;
    
    -- Process appointments in chronological order
    FOR appointment_record IN
      SELECT 
        id,
        appointment_datetime,
        expected_duration_minutes,
        status,
        patient_checked_in,
        actual_start_time
      FROM appointments
      WHERE doctor_id = p_doctor_id 
        AND service_day = p_service_day
        AND status IN ('Scheduled', 'Checked-In', 'In-Progress')
      ORDER BY 
        -- Prioritize checked-in patients and in-progress appointments
        CASE 
          WHEN status = 'In-Progress' THEN 1
          WHEN patient_checked_in = true THEN 2
          ELSE 3
        END,
        appointment_datetime ASC
    LOOP
      -- Update queue position and ETA
      UPDATE appointments 
      SET 
        queue_position = current_position,
        estimated_start_time = current_eta,
        updated_at = now()
      WHERE id = appointment_record.id;
      
      -- Calculate next ETA
      current_eta := current_eta + (appointment_record.expected_duration_minutes || ' minutes')::interval;
      current_position := current_position + 1;
      total_updated := total_updated + 1;
      
      -- Log the event
      INSERT INTO appointment_events (
        appointment_id,
        event_type,
        new_values,
        timestamp,
        metadata
      ) VALUES (
        appointment_record.id,
        'ETA_UPDATED',
        json_build_object(
          'queue_position', current_position - 1,
          'estimated_start_time', current_eta - (appointment_record.expected_duration_minutes || ' minutes')::interval
        ),
        now(),
        json_build_object('recalculation_trigger', 'queue_management')
      );
      
    END LOOP;
    
    -- Schedule notification jobs for ETA updates
    INSERT INTO job_queue (job_type, payload, priority, scheduled_for)
    SELECT 
      'SEND_NOTIFICATION',
      json_build_object(
        'appointment_id', id,
        'notification_type', 'ETA_UPDATE',
        'estimated_start_time', estimated_start_time
      ),
      3, -- Medium priority
      now() + interval '1 minute' -- Send after 1 minute delay
    FROM appointments
    WHERE doctor_id = p_doctor_id 
      AND service_day = p_service_day
      AND status IN ('Scheduled', 'Checked-In')
      AND estimated_start_time IS NOT NULL;
    
    result := json_build_object(
      'success', true,
      'updated_count', total_updated,
      'clinic_start_time', clinic_start_time,
      'last_eta', current_eta
    );
    
  EXCEPTION WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'updated_count', 0
    );
  END;
  
  -- Always release the lock
  PERFORM release_queue_lock(lock_key, 'queue_recalculation');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. APPOINTMENT STATUS HANDLERS
-- ========================================

CREATE OR REPLACE FUNCTION handle_appointment_checkin(
  p_appointment_id uuid
) RETURNS json AS $$
DECLARE
  appointment_record RECORD;
  result json;
BEGIN
  -- Get appointment details
  SELECT 
    id, doctor_id, service_day, status, patient_checked_in
  INTO appointment_record
  FROM appointments
  WHERE id = p_appointment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Appointment not found'
    );
  END IF;
  
  IF appointment_record.status != 'Scheduled' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Appointment is not in scheduled status'
    );
  END IF;
  
  -- Update appointment
  UPDATE appointments
  SET 
    patient_checked_in = true,
    checked_in_at = now(),
    status = 'Checked-In',
    updated_at = now()
  WHERE id = p_appointment_id;
  
  -- Log the event
  INSERT INTO appointment_events (
    appointment_id,
    event_type,
    new_values,
    timestamp
  ) VALUES (
    p_appointment_id,
    'CHECKED_IN',
    json_build_object(
      'patient_checked_in', true,
      'checked_in_at', now(),
      'status', 'Checked-In'
    ),
    now()
  );
  
  -- Trigger queue recalculation
  INSERT INTO job_queue (job_type, payload, priority)
  VALUES (
    'RECALCULATE_QUEUE',
    json_build_object(
      'doctor_id', appointment_record.doctor_id,
      'service_day', appointment_record.service_day,
      'trigger', 'patient_checkin'
    ),
    1 -- High priority
  );
  
  RETURN json_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'status', 'Checked-In'
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_appointment_completion(
  p_appointment_id uuid
) RETURNS json AS $$
DECLARE
  appointment_record RECORD;
  result json;
BEGIN
  -- Get appointment details
  SELECT 
    id, doctor_id, service_day, status
  INTO appointment_record
  FROM appointments
  WHERE id = p_appointment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Appointment not found'
    );
  END IF;
  
  -- Update appointment
  UPDATE appointments
  SET 
    status = 'Completed',
    actual_end_time = now(),
    updated_at = now()
  WHERE id = p_appointment_id;
  
  -- Log the event
  INSERT INTO appointment_events (
    appointment_id,
    event_type,
    new_values,
    timestamp
  ) VALUES (
    p_appointment_id,
    'COMPLETED',
    json_build_object(
      'status', 'Completed',
      'actual_end_time', now()
    ),
    now()
  );
  
  -- Trigger queue recalculation for remaining appointments
  INSERT INTO job_queue (job_type, payload, priority)
  VALUES (
    'RECALCULATE_QUEUE',
    json_build_object(
      'doctor_id', appointment_record.doctor_id,
      'service_day', appointment_record.service_day,
      'trigger', 'appointment_completion'
    ),
    1 -- High priority
  );
  
  RETURN json_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'status', 'Completed'
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. CONFLICT DETECTION
-- ========================================

CREATE OR REPLACE FUNCTION check_appointment_conflicts(
  p_doctor_id uuid,
  p_appointment_datetime timestamptz,
  p_duration_minutes integer,
  p_exclude_appointment_id uuid DEFAULT NULL
) RETURNS json AS $$
DECLARE
  conflict_count integer;
  conflicts json;
BEGIN
  -- Check for overlapping appointments
  SELECT 
    COUNT(*),
    json_agg(
      json_build_object(
        'id', id,
        'appointment_datetime', appointment_datetime,
        'duration_minutes', expected_duration_minutes,
        'patient_name', (SELECT name FROM patients WHERE id = patient_id)
      )
    )
  INTO conflict_count, conflicts
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND status IN ('Scheduled', 'Checked-In', 'In-Progress')
    AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id)
    AND (
      -- New appointment starts during existing appointment
      (p_appointment_datetime >= appointment_datetime 
       AND p_appointment_datetime < appointment_datetime + (expected_duration_minutes || ' minutes')::interval)
      OR
      -- New appointment ends during existing appointment
      (p_appointment_datetime + (p_duration_minutes || ' minutes')::interval > appointment_datetime
       AND p_appointment_datetime + (p_duration_minutes || ' minutes')::interval <= appointment_datetime + (expected_duration_minutes || ' minutes')::interval)
      OR
      -- New appointment completely overlaps existing appointment
      (p_appointment_datetime <= appointment_datetime
       AND p_appointment_datetime + (p_duration_minutes || ' minutes')::interval >= appointment_datetime + (expected_duration_minutes || ' minutes')::interval)
    );
  
  RETURN json_build_object(
    'has_conflicts', conflict_count > 0,
    'conflict_count', conflict_count,
    'conflicts', COALESCE(conflicts, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. ANALYTICS AND REPORTING
-- ========================================

CREATE OR REPLACE FUNCTION get_queue_analytics(
  p_doctor_id uuid,
  p_service_day date
) RETURNS json AS $$
DECLARE
  total_appointments integer;
  checked_in_count integer;
  completed_count integer;
  avg_wait_time interval;
  current_queue_length integer;
  estimated_completion_time timestamptz;
BEGIN
  -- Get basic counts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE patient_checked_in = true),
    COUNT(*) FILTER (WHERE status = 'Completed')
  INTO total_appointments, checked_in_count, completed_count
  FROM appointments
  WHERE doctor_id = p_doctor_id 
    AND service_day = p_service_day;
  
  -- Calculate average wait time for completed appointments
  SELECT AVG(actual_start_time - checked_in_at)
  INTO avg_wait_time
  FROM appointments
  WHERE doctor_id = p_doctor_id 
    AND service_day = p_service_day
    AND status = 'Completed'
    AND checked_in_at IS NOT NULL
    AND actual_start_time IS NOT NULL;
  
  -- Get current queue length
  SELECT COUNT(*)
  INTO current_queue_length
  FROM appointments
  WHERE doctor_id = p_doctor_id 
    AND service_day = p_service_day
    AND status IN ('Scheduled', 'Checked-In', 'In-Progress');
  
  -- Get estimated completion time
  SELECT MAX(estimated_start_time + (expected_duration_minutes || ' minutes')::interval)
  INTO estimated_completion_time
  FROM appointments
  WHERE doctor_id = p_doctor_id 
    AND service_day = p_service_day
    AND status IN ('Scheduled', 'Checked-In', 'In-Progress');
  
  RETURN json_build_object(
    'total_appointments', total_appointments,
    'checked_in_count', checked_in_count,
    'completed_count', completed_count,
    'completion_rate', CASE WHEN total_appointments > 0 THEN completed_count::float / total_appointments ELSE 0 END,
    'average_wait_time_minutes', CASE WHEN avg_wait_time IS NOT NULL THEN EXTRACT(EPOCH FROM avg_wait_time) / 60 ELSE NULL END,
    'current_queue_length', current_queue_length,
    'estimated_completion_time', estimated_completion_time
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. AUTOMATED TRIGGERS
-- ========================================

-- Trigger to automatically recalculate queue when appointment status changes
CREATE OR REPLACE FUNCTION trigger_queue_recalculation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for relevant status changes
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) OR
     (TG_OP = 'UPDATE' AND OLD.patient_checked_in != NEW.patient_checked_in) OR
     (TG_OP = 'INSERT') THEN
    
    -- Schedule queue recalculation job
    INSERT INTO job_queue (job_type, payload, priority, scheduled_for)
    VALUES (
      'RECALCULATE_QUEUE',
      json_build_object(
        'doctor_id', NEW.doctor_id,
        'service_day', NEW.service_day,
        'trigger_type', TG_OP,
        'appointment_id', NEW.id
      ),
      CASE 
        WHEN NEW.status = 'In-Progress' THEN 1  -- Highest priority
        WHEN NEW.patient_checked_in = true THEN 2  -- High priority
        ELSE 3  -- Medium priority
      END,
      now() + interval '30 seconds'  -- Small delay to batch changes
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger
DROP TRIGGER IF EXISTS appointment_queue_trigger ON appointments;
CREATE TRIGGER appointment_queue_trigger
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_queue_recalculation();
