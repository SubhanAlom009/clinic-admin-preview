-- Comprehensive schema fix for clinic administration system
-- Fixes constraint mismatches and adds missing tables
-- Date: 2025-09-05

-- Drop existing constraint if it exists with wrong values
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

-- Update appointments table status constraint to match constants
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show', 'rescheduled'));

-- Add missing queue/ETA fields to appointments if they don't exist
DO $$ 
BEGIN
    -- Add queue position field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'queue_position') THEN
        ALTER TABLE appointments ADD COLUMN queue_position integer;
    END IF;
    
    -- Add estimated start time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'estimated_start_time') THEN
        ALTER TABLE appointments ADD COLUMN estimated_start_time timestamptz;
    END IF;
    
    -- Add actual start time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'actual_start_time') THEN
        ALTER TABLE appointments ADD COLUMN actual_start_time timestamptz;
    END IF;
    
    -- Add actual end time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'actual_end_time') THEN
        ALTER TABLE appointments ADD COLUMN actual_end_time timestamptz;
    END IF;
    
    -- Add patient checked in flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'patient_checked_in') THEN
        ALTER TABLE appointments ADD COLUMN patient_checked_in boolean DEFAULT false;
    END IF;
    
    -- Add checked in at timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'checked_in_at') THEN
        ALTER TABLE appointments ADD COLUMN checked_in_at timestamptz;
    END IF;
    
    -- Add service day if missing (for queue management)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'service_day') THEN
        ALTER TABLE appointments ADD COLUMN service_day date GENERATED ALWAYS AS (appointment_datetime::date) STORED;
    END IF;
    
    -- Add expected duration minutes if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'expected_duration_minutes') THEN
        ALTER TABLE appointments ADD COLUMN expected_duration_minutes integer DEFAULT 30;
    END IF;
END $$;

-- Create job_queue table (missing table causing 404 error)
CREATE TABLE IF NOT EXISTS job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('RECALCULATE_QUEUE','SEND_NOTIFICATION','CLEANUP_EXPIRED','BACKUP_DATA')),
  payload jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED')),
  priority integer DEFAULT 3,
  attempts integer DEFAULT 0,
  scheduled_for timestamptz DEFAULT now(),
  available_at timestamptz DEFAULT now(),
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notification_outbox for better notification handling
CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_channel text CHECK (delivery_channel IN ('sms','email','in-app','push')),
  payload jsonb NOT NULL,
  delivery_status text DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED', 'RETRY')),
  attempts integer DEFAULT 0,
  last_attempt_at timestamptz,
  scheduled_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create appointment_events for audit trail
CREATE TABLE IF NOT EXISTS appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now()
);

-- Create queue_locks for distributed processing
CREATE TABLE IF NOT EXISTS queue_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  locked_by text,
  locked_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_queue_pos ON appointments(doctor_id, service_day, queue_position);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_estimated_start ON appointments(estimated_start_time);
CREATE INDEX IF NOT EXISTS idx_job_queue_status_priority ON job_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled_for ON job_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON notification_outbox(delivery_status);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON appointment_events(timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_locks_resource ON queue_locks(resource);

-- Unique constraint for queue positions (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_queue_unique 
  ON appointments(doctor_id, service_day, queue_position) 
  WHERE status IN ('scheduled', 'checked-in', 'in-progress');

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers for new tables
DROP TRIGGER IF EXISTS update_job_queue_updated_at ON job_queue;
CREATE TRIGGER update_job_queue_updated_at 
  BEFORE UPDATE ON job_queue 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_outbox_updated_at ON notification_outbox;
CREATE TRIGGER update_notification_outbox_updated_at 
  BEFORE UPDATE ON notification_outbox 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and create policies
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage jobs" ON job_queue
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications" ON notification_outbox
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id);

ALTER TABLE appointment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own appointment events" ON appointment_events
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id);

ALTER TABLE queue_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage queue locks" ON queue_locks
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Fix existing data if status values are wrong
UPDATE appointments 
SET status = 'scheduled' 
WHERE status = 'Scheduled';

UPDATE appointments 
SET status = 'completed' 
WHERE status = 'Completed';

UPDATE appointments 
SET status = 'cancelled' 
WHERE status = 'Cancelled';

UPDATE appointments 
SET status = 'no-show' 
WHERE status = 'No-Show';

UPDATE appointments 
SET status = 'rescheduled' 
WHERE status = 'Rescheduled';

UPDATE appointments 
SET status = 'checked-in' 
WHERE status = 'Checked-In';

UPDATE appointments 
SET status = 'in-progress' 
WHERE status = 'In-Progress';

-- Ensure notifications table has correct structure if it exists
DO $$ 
BEGIN
    -- Check if notifications table exists and update if needed
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
            ALTER TABLE notifications ADD COLUMN priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high'));
        END IF;
    ELSE
        -- Create notifications table if it doesn't exist
        CREATE TABLE notifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
          type text NOT NULL,
          title text NOT NULL,
          message text NOT NULL,
          status text DEFAULT 'unread' CHECK (status IN ('unread','read')),
          priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
          created_at timestamptz DEFAULT now()
        );
        
        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can manage own notifications" ON notifications
          FOR ALL TO authenticated 
          USING (auth.uid() = user_id);
    END IF;
END $$;
