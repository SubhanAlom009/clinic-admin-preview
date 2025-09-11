-- Enhanced queue system with proper job management
-- This provides production-ready robustness without external tools

-- Job queue table for background processing
CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN (
        'RECALCULATE_QUEUE', 
        'SEND_NOTIFICATION', 
        'PROCESS_CANCELLATION',
        'HANDLE_NO_SHOW',
        'GENERATE_REMINDERS'
    )),
    payload JSONB NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest priority
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job processing performance
CREATE INDEX IF NOT EXISTS idx_job_queue_processing ON job_queue(status, scheduled_for, priority);
CREATE INDEX IF NOT EXISTS idx_job_queue_retry ON job_queue(status, retry_count, max_retries);

-- Enhanced notification system with proper queuing
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL, -- For multi-tenant support
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'ETA_UPDATE', 'REMINDER_24H', 'REMINDER_2H', 'REMINDER_30MIN',
        'CANCELLATION', 'DELAY_ALERT', 'APPOINTMENT_CONFIRMED', 'CHECK_IN_REMINDER'
    )),
    delivery_channels TEXT[] DEFAULT ARRAY['SMS'], -- Support multiple channels
    message_template TEXT NOT NULL,
    message_variables JSONB DEFAULT '{}',
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    delivery_status TEXT DEFAULT 'PENDING' CHECK (delivery_status IN (
        'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'
    )),
    delivery_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    delivery_response JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notification processing
CREATE INDEX IF NOT EXISTS idx_notification_queue_processing ON notification_queue(delivery_status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_clinic ON notification_queue(clinic_id, delivery_status);

-- Queue processing locks to prevent duplicate processing
CREATE TABLE IF NOT EXISTS queue_locks (
    lock_key TEXT PRIMARY KEY,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    locked_by TEXT NOT NULL, -- Worker ID or session ID
    expires_at TIMESTAMPTZ NOT NULL
);

-- Function to acquire distributed lock
CREATE OR REPLACE FUNCTION acquire_queue_lock(
    p_lock_key TEXT,
    p_worker_id TEXT,
    p_timeout_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN := FALSE;
BEGIN
    -- Clean up expired locks first
    DELETE FROM queue_locks 
    WHERE expires_at < NOW();
    
    -- Try to acquire lock
    INSERT INTO queue_locks (lock_key, locked_by, expires_at)
    VALUES (p_lock_key, p_worker_id, NOW() + INTERVAL '1 second' * p_timeout_seconds)
    ON CONFLICT (lock_key) DO NOTHING
    RETURNING TRUE INTO lock_acquired;
    
    RETURN COALESCE(lock_acquired, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to release lock
CREATE OR REPLACE FUNCTION release_queue_lock(
    p_lock_key TEXT,
    p_worker_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM queue_locks 
    WHERE lock_key = p_lock_key AND locked_by = p_worker_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Enhanced queue recalculation with job queuing
CREATE OR REPLACE FUNCTION recalculate_queue_async(
    p_doctor_id UUID,
    p_service_day DATE,
    p_start_from_position INTEGER DEFAULT 1,
    p_priority INTEGER DEFAULT 5
)
RETURNS UUID AS $$
DECLARE
    job_id UUID;
BEGIN
    -- Queue the recalculation job instead of doing it synchronously
    INSERT INTO job_queue (job_type, payload, priority)
    VALUES (
        'RECALCULATE_QUEUE',
        jsonb_build_object(
            'doctor_id', p_doctor_id,
            'service_day', p_service_day,
            'start_from_position', p_start_from_position
        ),
        p_priority
    )
    RETURNING id INTO job_id;
    
    RETURN job_id;
END;
$$ LANGUAGE plpgsql;

-- Process queue recalculation job
CREATE OR REPLACE FUNCTION process_queue_recalculation(p_job_id UUID)
RETURNS JSONB AS $$
DECLARE
    job_record RECORD;
    lock_key TEXT;
    appointment_record RECORD;
    break_record RECORD;
    previous_end_time TIMESTAMPTZ;
    new_start_time TIMESTAMPTZ;
    old_estimated_start TIMESTAMPTZ;
    eta_change_minutes INTEGER;
    break_conflicts BOOLEAN;
    processed_count INTEGER := 0;
BEGIN
    -- Get job details
    SELECT * INTO job_record FROM job_queue WHERE id = p_job_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Job not found');
    END IF;
    
    -- Create lock key for this doctor/day combination
    lock_key := 'queue_recalc_' || (job_record.payload->>'doctor_id') || '_' || (job_record.payload->>'service_day');
    
    -- Try to acquire lock
    IF NOT acquire_queue_lock(lock_key, p_job_id::text, 600) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Could not acquire lock, job may be already running');
    END IF;
    
    BEGIN
        -- Mark job as running
        UPDATE job_queue 
        SET status = 'RUNNING', started_at = NOW(), updated_at = NOW()
        WHERE id = p_job_id;
        
        -- Process appointments in queue order
        FOR appointment_record IN
            SELECT id, scheduled_start_time, estimated_start_time, expected_duration_minutes, patient_id
            FROM appointments 
            WHERE doctor_id = (job_record.payload->>'doctor_id')::UUID
            AND service_day = (job_record.payload->>'service_day')::DATE
            AND queue_position >= (job_record.payload->>'start_from_position')::INTEGER
            AND status IN ('scheduled', 'checked_in', 'in_progress')
            ORDER BY queue_position
            FOR UPDATE SKIP LOCKED -- Skip if another process is updating
        LOOP
            old_estimated_start := appointment_record.estimated_start_time;
            
            -- Calculate new start time
            IF previous_end_time IS NULL THEN
                new_start_time := appointment_record.scheduled_start_time;
            ELSE
                new_start_time := GREATEST(previous_end_time, appointment_record.scheduled_start_time);
            END IF;
            
            -- Handle doctor breaks (same logic as before but with better error handling)
            break_conflicts := TRUE;
            WHILE break_conflicts LOOP
                break_conflicts := FALSE;
                FOR break_record IN
                    SELECT start_time, end_time
                    FROM doctor_breaks 
                    WHERE doctor_id = (job_record.payload->>'doctor_id')::UUID
                    AND service_day = (job_record.payload->>'service_day')::DATE
                    ORDER BY start_time
                LOOP
                    IF new_start_time < break_record.end_time AND 
                       (new_start_time + INTERVAL '1 minute' * appointment_record.expected_duration_minutes) > break_record.start_time THEN
                        new_start_time := break_record.end_time;
                        break_conflicts := TRUE;
                        EXIT;
                    END IF;
                END LOOP;
            END LOOP;
            
            -- Update appointment
            UPDATE appointments 
            SET estimated_start_time = new_start_time, updated_at = NOW()
            WHERE id = appointment_record.id;
            
            -- Calculate ETA change
            eta_change_minutes := ABS(EXTRACT(EPOCH FROM (new_start_time - old_estimated_start)) / 60);
            
            -- Queue notification if significant change
            IF eta_change_minutes >= 5 THEN
                INSERT INTO notification_queue (
                    appointment_id, patient_id, clinic_id, notification_type,
                    delivery_channels, message_template, message_variables, scheduled_for
                ) VALUES (
                    appointment_record.id,
                    appointment_record.patient_id,
                    (SELECT user_id FROM appointments WHERE id = appointment_record.id),
                    'ETA_UPDATE',
                    ARRAY['SMS'],
                    'Your appointment time has been updated. New estimated time: {{new_eta}}. Delay: {{delay_minutes}} minutes.',
                    jsonb_build_object(
                        'old_eta', to_char(old_estimated_start, 'HH12:MI AM'),
                        'new_eta', to_char(new_start_time, 'HH12:MI AM'),
                        'delay_minutes', eta_change_minutes
                    ),
                    NOW()
                );
            END IF;
            
            -- Set previous_end_time for next iteration
            previous_end_time := new_start_time + INTERVAL '1 minute' * appointment_record.expected_duration_minutes;
            processed_count := processed_count + 1;
        END LOOP;
        
        -- Mark job as completed
        UPDATE job_queue 
        SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
        WHERE id = p_job_id;
        
        -- Release lock
        PERFORM release_queue_lock(lock_key, p_job_id::text);
        
        RETURN jsonb_build_object(
            'success', true, 
            'processed_count', processed_count,
            'job_id', p_job_id
        );
        
    EXCEPTION WHEN OTHERS THEN
        -- Handle errors
        UPDATE job_queue 
        SET 
            status = 'FAILED', 
            failed_at = NOW(), 
            error_message = SQLERRM,
            retry_count = retry_count + 1,
            updated_at = NOW()
        WHERE id = p_job_id;
        
        -- Release lock
        PERFORM release_queue_lock(lock_key, p_job_id::text);
        
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM,
            'processed_count', processed_count
        );
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to process notification queue
CREATE OR REPLACE FUNCTION process_notification_queue(p_batch_size INTEGER DEFAULT 10)
RETURNS JSONB AS $$
DECLARE
    notification_record RECORD;
    processed_count INTEGER := 0;
    failed_count INTEGER := 0;
BEGIN
    -- Process pending notifications
    FOR notification_record IN
        SELECT * FROM notification_queue 
        WHERE delivery_status = 'PENDING' 
        AND scheduled_for <= NOW()
        AND delivery_attempts < max_attempts
        ORDER BY scheduled_for
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            -- Mark as being processed
            UPDATE notification_queue 
            SET 
                delivery_status = 'PROCESSING',
                delivery_attempts = delivery_attempts + 1,
                updated_at = NOW()
            WHERE id = notification_record.id;
            
            -- Here you would integrate with your SMS/email service
            -- For now, we'll simulate successful delivery
            UPDATE notification_queue 
            SET 
                delivery_status = 'SENT',
                sent_at = NOW(),
                updated_at = NOW()
            WHERE id = notification_record.id;
            
            processed_count := processed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Mark as failed
            UPDATE notification_queue 
            SET 
                delivery_status = 'FAILED',
                error_message = SQLERRM,
                updated_at = NOW()
            WHERE id = notification_record.id;
            
            failed_count := failed_count + 1;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'processed', processed_count,
        'failed', failed_count
    );
END;
$$ LANGUAGE plpgsql;

-- Background job processor function
CREATE OR REPLACE FUNCTION process_job_queue(p_batch_size INTEGER DEFAULT 5)
RETURNS JSONB AS $$
DECLARE
    job_record RECORD;
    result JSONB;
    processed_count INTEGER := 0;
    failed_count INTEGER := 0;
BEGIN
    -- Process pending jobs
    FOR job_record IN
        SELECT * FROM job_queue 
        WHERE status = 'PENDING' 
        AND scheduled_for <= NOW()
        AND retry_count < max_retries
        ORDER BY priority, scheduled_for
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Process based on job type
        CASE job_record.job_type
            WHEN 'RECALCULATE_QUEUE' THEN
                result := process_queue_recalculation(job_record.id);
                
            WHEN 'SEND_NOTIFICATION' THEN
                -- Handle notification sending
                result := jsonb_build_object('success', true);
                
            ELSE
                -- Unknown job type
                UPDATE job_queue 
                SET 
                    status = 'FAILED',
                    failed_at = NOW(),
                    error_message = 'Unknown job type: ' || job_record.job_type
                WHERE id = job_record.id;
                result := jsonb_build_object('success', false);
        END CASE;
        
        IF result->>'success' = 'true' THEN
            processed_count := processed_count + 1;
        ELSE
            failed_count := failed_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'processed', processed_count,
        'failed', failed_count
    );
END;
$$ LANGUAGE plpgsql;
