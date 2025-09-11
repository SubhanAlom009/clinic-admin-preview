-- Core Queue Management Functions
-- Migration: 20250904_queue_management_functions.sql

-- Function to recalculate appointment queue
CREATE OR REPLACE FUNCTION recalculate_queue(
    p_doctor_id UUID,
    p_service_day DATE,
    p_start_from_position INTEGER DEFAULT 1
)
RETURNS TABLE(
    appointment_id UUID,
    old_eta TIMESTAMPTZ,
    new_eta TIMESTAMPTZ,
    eta_change_minutes INTEGER
) AS $$
DECLARE
    appointment_record RECORD;
    break_record RECORD;
    previous_end_time TIMESTAMPTZ;
    new_start_time TIMESTAMPTZ;
    old_estimated_start TIMESTAMPTZ;
    eta_change INTERVAL;
    eta_change_mins INTEGER;
    current_user_id UUID;
BEGIN
    -- Get current user
    current_user_id := auth.uid();
    
    -- Lock appointments for this doctor/day to prevent race conditions
    FOR appointment_record IN
        SELECT a.id, a.scheduled_start_time, a.estimated_start_time, a.expected_duration_minutes, 
               a.queue_position, a.patient_id, a.status
        FROM appointments a
        WHERE a.doctor_id = p_doctor_id 
        AND DATE(a.appointment_datetime) = p_service_day
        AND a.queue_position >= p_start_from_position
        AND a.status IN ('Scheduled', 'Checked-In', 'In-Progress')
        ORDER BY a.queue_position
        FOR UPDATE
    LOOP
        old_estimated_start := appointment_record.estimated_start_time;
        
        -- Core propagation formula
        IF previous_end_time IS NULL THEN
            -- First appointment or starting fresh
            new_start_time := appointment_record.scheduled_start_time;
        ELSE
            new_start_time := GREATEST(previous_end_time, appointment_record.scheduled_start_time);
        END IF;
        
        -- Push past any doctor breaks
        FOR break_record IN
            SELECT start_time, end_time
            FROM doctor_breaks 
            WHERE doctor_id = p_doctor_id 
            AND service_day = p_service_day 
            ORDER BY start_time
        LOOP
            IF new_start_time < break_record.end_time AND 
               (new_start_time + INTERVAL '1 minute' * appointment_record.expected_duration_minutes) > break_record.start_time THEN
                -- Appointment overlaps with break, push after break
                new_start_time := break_record.end_time;
            END IF;
        END LOOP;
        
        -- Calculate next appointment's earliest start time
        previous_end_time := new_start_time + INTERVAL '1 minute' * appointment_record.expected_duration_minutes;
        
        -- Update appointment in database
        UPDATE appointments 
        SET estimated_start_time = new_start_time, 
            updated_at = NOW()
        WHERE id = appointment_record.id;
        
        -- Calculate ETA change in minutes
        eta_change := new_start_time - old_estimated_start;
        eta_change_mins := EXTRACT(EPOCH FROM eta_change) / 60;
        
        -- Check if ETA change exceeds threshold (5 minutes)
        IF ABS(eta_change_mins) >= 5 THEN
            -- Enqueue ETA update notification
            INSERT INTO notification_outbox (
                appointment_id, patient_id, notification_type, message_content, 
                delivery_method, scheduled_for
            ) VALUES (
                appointment_record.id, 
                appointment_record.patient_id,
                'ETA_UPDATE',
                jsonb_build_object(
                    'old_eta', old_estimated_start,
                    'new_eta', new_start_time,
                    'delay_minutes', eta_change_mins,
                    'doctor_id', p_doctor_id,
                    'appointment_id', appointment_record.id
                ),
                'SMS',
                NOW()
            );
        END IF;
        
        -- Log the event
        INSERT INTO appointment_events (
            appointment_id, event_type, old_values, new_values, triggered_by, timestamp
        ) VALUES (
            appointment_record.id,
            'ETA_UPDATED',
            jsonb_build_object('estimated_start_time', old_estimated_start),
            jsonb_build_object('estimated_start_time', new_start_time),
            current_user_id,
            NOW()
        );
        
        -- Return the change for monitoring
        appointment_id := appointment_record.id;
        old_eta := old_estimated_start;
        new_eta := new_start_time;
        eta_change_minutes := eta_change_mins;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete an appointment
CREATE OR REPLACE FUNCTION complete_appointment(
    p_appointment_id UUID,
    p_actual_end_time TIMESTAMPTZ DEFAULT NOW(),
    p_diagnosis TEXT DEFAULT NULL,
    p_prescription TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    appointment_record RECORD;
    current_user_id UUID;
    result JSON;
BEGIN
    current_user_id := auth.uid();
    
    -- Get appointment details
    SELECT doctor_id, DATE(appointment_datetime) as service_day, queue_position, patient_id, status
    INTO appointment_record
    FROM appointments 
    WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Appointment not found');
    END IF;
    
    IF appointment_record.status NOT IN ('In-Progress', 'Scheduled', 'Checked-In') THEN
        RETURN json_build_object('success', false, 'error', 'Appointment cannot be completed');
    END IF;
    
    -- Update completed appointment
    UPDATE appointments 
    SET status = 'Completed',
        actual_end_time = p_actual_end_time,
        diagnosis = COALESCE(p_diagnosis, diagnosis),
        prescription = COALESCE(p_prescription, prescription),
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_appointment_id;
    
    -- Log completion event
    INSERT INTO appointment_events (
        appointment_id, event_type, new_values, triggered_by, timestamp
    ) VALUES (
        p_appointment_id,
        'COMPLETED',
        jsonb_build_object(
            'actual_end_time', p_actual_end_time,
            'diagnosis', p_diagnosis,
            'prescription', p_prescription,
            'notes', p_notes
        ),
        current_user_id,
        NOW()
    );
    
    -- Recalculate queue for remaining appointments
    PERFORM recalculate_queue(
        appointment_record.doctor_id, 
        appointment_record.service_day, 
        appointment_record.queue_position + 1
    );
    
    RETURN json_build_object(
        'success', true, 
        'appointment_id', p_appointment_id,
        'completed_at', p_actual_end_time
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle patient cancellation
CREATE OR REPLACE FUNCTION cancel_appointment(
    p_appointment_id UUID,
    p_cancelled_by UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    appointment_record RECORD;
    current_user_id UUID;
BEGIN
    current_user_id := COALESCE(p_cancelled_by, auth.uid());
    
    -- Get appointment details before cancellation
    SELECT doctor_id, DATE(appointment_datetime) as service_day, queue_position, patient_id, status
    INTO appointment_record
    FROM appointments 
    WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Appointment not found');
    END IF;
    
    IF appointment_record.status IN ('Completed', 'Cancelled', 'No-Show') THEN
        RETURN json_build_object('success', false, 'error', 'Appointment already processed');
    END IF;
    
    -- Mark as cancelled
    UPDATE appointments 
    SET status = 'Cancelled', 
        updated_at = NOW(),
        notes = COALESCE(notes || E'\n', '') || 'Cancelled: ' || COALESCE(p_reason, 'No reason provided')
    WHERE id = p_appointment_id;
    
    -- Compact queue - decrement positions for appointments after cancelled slot
    UPDATE appointments 
    SET queue_position = queue_position - 1, 
        updated_at = NOW()
    WHERE doctor_id = appointment_record.doctor_id 
    AND DATE(appointment_datetime) = appointment_record.service_day
    AND queue_position > appointment_record.queue_position
    AND status IN ('Scheduled', 'Checked-In');
    
    -- Notify about cancellation
    INSERT INTO notification_outbox (
        appointment_id, patient_id, notification_type, message_content,
        delivery_method, scheduled_for
    ) VALUES (
        p_appointment_id,
        appointment_record.patient_id,
        'CANCELLATION',
        jsonb_build_object(
            'cancelled_by', current_user_id,
            'reason', p_reason,
            'queue_position', appointment_record.queue_position
        ),
        'SMS',
        NOW()
    );
    
    -- Log cancellation event
    INSERT INTO appointment_events (
        appointment_id, event_type, triggered_by, metadata, timestamp
    ) VALUES (
        p_appointment_id,
        'CANCELLED',
        current_user_id,
        jsonb_build_object('cancelled_by', current_user_id, 'reason', p_reason),
        NOW()
    );
    
    -- Recalculate queue for remaining appointments
    PERFORM recalculate_queue(
        appointment_record.doctor_id, 
        appointment_record.service_day, 
        appointment_record.queue_position
    );
    
    RETURN json_build_object(
        'success', true, 
        'appointment_id', p_appointment_id,
        'cancelled_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check in patient
CREATE OR REPLACE FUNCTION checkin_patient(
    p_appointment_id UUID,
    p_checked_in_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Update check-in status
    UPDATE appointments 
    SET patient_checked_in = true,
        checked_in_at = p_checked_in_at,
        status = CASE WHEN status = 'Scheduled' THEN 'Checked-In' ELSE status END,
        updated_at = NOW()
    WHERE id = p_appointment_id
    AND status IN ('Scheduled', 'Checked-In');
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Appointment not found or cannot be checked in');
    END IF;
    
    -- Log check-in event
    INSERT INTO appointment_events (
        appointment_id, event_type, new_values, triggered_by, timestamp
    ) VALUES (
        p_appointment_id,
        'CHECKED_IN',
        jsonb_build_object('checked_in_at', p_checked_in_at),
        current_user_id,
        NOW()
    );
    
    RETURN json_build_object(
        'success', true, 
        'appointment_id', p_appointment_id,
        'checked_in_at', p_checked_in_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start appointment
CREATE OR REPLACE FUNCTION start_appointment(
    p_appointment_id UUID,
    p_actual_start_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON AS $$
DECLARE
    appointment_record RECORD;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Get appointment details
    SELECT doctor_id, DATE(appointment_datetime) as service_day, queue_position, scheduled_start_time, estimated_start_time
    INTO appointment_record
    FROM appointments 
    WHERE id = p_appointment_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Appointment not found');
    END IF;
    
    -- Update appointment status and actual start time
    UPDATE appointments 
    SET status = 'In-Progress',
        actual_start_time = p_actual_start_time,
        updated_at = NOW()
    WHERE id = p_appointment_id
    AND status IN ('Scheduled', 'Checked-In');
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Appointment cannot be started');
    END IF;
    
    -- Log start event
    INSERT INTO appointment_events (
        appointment_id, event_type, new_values, triggered_by, timestamp
    ) VALUES (
        p_appointment_id,
        'STARTED',
        jsonb_build_object('actual_start_time', p_actual_start_time),
        current_user_id,
        NOW()
    );
    
    -- If appointment started late, recalculate queue
    IF p_actual_start_time > appointment_record.estimated_start_time + INTERVAL '5 minutes' THEN
        PERFORM recalculate_queue(
            appointment_record.doctor_id, 
            appointment_record.service_day, 
            appointment_record.queue_position + 1
        );
    END IF;
    
    RETURN json_build_object(
        'success', true, 
        'appointment_id', p_appointment_id,
        'started_at', p_actual_start_time
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
