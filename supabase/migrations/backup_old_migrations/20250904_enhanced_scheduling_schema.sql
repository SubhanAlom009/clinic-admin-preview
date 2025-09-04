-- Enhanced Appointment Scheduling Schema
-- Migration: 20250904_enhanced_scheduling_schema.sql

-- Doctor schedules (working hours)
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for doctor schedules
CREATE INDEX IF NOT EXISTS idx_schedule_doctor_day ON doctor_schedules(doctor_id, day_of_week);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_unique ON doctor_schedules(doctor_id, day_of_week, start_time) WHERE is_active = true;

-- Doctor breaks and unavailability blocks
CREATE TABLE IF NOT EXISTS doctor_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    service_day DATE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    break_type TEXT NOT NULL DEFAULT 'Break' CHECK (break_type IN ('Break', 'Lunch', 'Emergency', 'Unavailable')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for doctor breaks
CREATE INDEX IF NOT EXISTS idx_breaks_doctor_day ON doctor_breaks(doctor_id, service_day);
CREATE INDEX IF NOT EXISTS idx_breaks_time ON doctor_breaks(start_time, end_time);

-- Notification outbox for reliable message delivery
CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('ETA_UPDATE', 'REMINDER_24H', 'REMINDER_2H', 'CANCELLATION', 'DELAY_ALERT')),
    message_content JSONB NOT NULL,
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('SMS', 'WHATSAPP', 'EMAIL')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    delivery_status TEXT DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED', 'RETRY')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notification outbox
CREATE INDEX IF NOT EXISTS idx_outbox_scheduled ON notification_outbox(scheduled_for, delivery_status);
CREATE INDEX IF NOT EXISTS idx_outbox_appointment ON notification_outbox(appointment_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON notification_outbox(delivery_status);

-- Appointment events audit trail
CREATE TABLE IF NOT EXISTS appointment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'CHECKED_IN', 'STARTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED', 'ETA_UPDATED')),
    old_values JSONB,
    new_values JSONB,
    triggered_by UUID REFERENCES auth.users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for appointment events
CREATE INDEX IF NOT EXISTS idx_events_appointment ON appointment_events(appointment_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON appointment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON appointment_events(timestamp);

-- Add new columns to existing appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS estimated_start_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS queue_position INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_checked_in BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS expected_duration_minutes INTEGER DEFAULT 15;

-- Update existing appointments to have queue positions and estimated start times
UPDATE appointments 
SET queue_position = row_number() OVER (
    PARTITION BY doctor_id, DATE(appointment_datetime) 
    ORDER BY appointment_datetime
),
estimated_start_time = appointment_datetime,
expected_duration_minutes = 15
WHERE queue_position IS NULL;

-- Add constraints and indexes for appointments
ALTER TABLE appointments ADD CONSTRAINT IF NOT EXISTS chk_status 
    CHECK (status IN ('Scheduled', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'));

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_day ON appointments(doctor_id, DATE(appointment_datetime));
CREATE INDEX IF NOT EXISTS idx_appointments_queue ON appointments(doctor_id, DATE(appointment_datetime), queue_position);
CREATE INDEX IF NOT EXISTS idx_appointments_estimated_start ON appointments(estimated_start_time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_queue ON appointments(doctor_id, DATE(appointment_datetime), queue_position) 
    WHERE status NOT IN ('Cancelled', 'No-Show', 'Completed');

-- RLS Policies
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_events ENABLE ROW LEVEL SECURITY;

-- Doctor schedules policies
CREATE POLICY "Users can manage their clinic's doctor schedules" ON doctor_schedules
    FOR ALL USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE user_id = auth.uid()
        )
    );

-- Doctor breaks policies
CREATE POLICY "Users can manage their clinic's doctor breaks" ON doctor_breaks
    FOR ALL USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE user_id = auth.uid()
        )
    );

-- Notification outbox policies (service role only)
CREATE POLICY "Service role can manage notifications" ON notification_outbox
    FOR ALL USING (auth.role() = 'service_role');

-- Appointment events policies (read-only for users)
CREATE POLICY "Users can view their clinic's appointment events" ON appointment_events
    FOR SELECT USING (
        appointment_id IN (
            SELECT id FROM appointments WHERE user_id = auth.uid()
        )
    );

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
CREATE TRIGGER update_doctor_schedules_updated_at 
    BEFORE UPDATE ON doctor_schedules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctor_breaks_updated_at 
    BEFORE UPDATE ON doctor_breaks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_outbox_updated_at 
    BEFORE UPDATE ON notification_outbox 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
