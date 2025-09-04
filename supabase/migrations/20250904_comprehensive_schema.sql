/*
# Comprehensive Clinic Administration Database Schema
# Single migration file - replaces all previous migrations
# Date: 2025-09-04
# Version: 2.0 - Production Ready

FEATURES:
- Complete clinic management system
- Advanced appointment scheduling with queue management
- Robust notification system with job processing
- Audit trails and real-time capabilities
- Production-grade indexes and constraints
*/

-- ========================================
-- 1. CORE USER PROFILES
-- ========================================

-- Profiles table for clinic information
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_name text NOT NULL DEFAULT '',
  admin_name text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text DEFAULT '',
  address text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile"
  ON profiles FOR ALL TO authenticated
  USING (auth.uid() = id);

-- ========================================
-- 2. PATIENT MANAGEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  age integer CHECK (age >= 0 AND age <= 150),
  gender text CHECK (gender IN ('Male', 'Female', 'Other')),
  contact text NOT NULL,
  email text,
  address text,
  emergency_contact text,
  medical_history jsonb DEFAULT '{}',
  allergies text[],
  chronic_conditions text[],
  insurance_info jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own patients"
  ON patients FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Patient indexes
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_patients_contact ON patients(contact);

-- ========================================
-- 3. DOCTOR MANAGEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  specialization text NOT NULL,
  qualifications text,
  contact text NOT NULL,
  email text,
  consultation_fee numeric(10,2) DEFAULT 0,
  experience_years integer DEFAULT 0,
  is_active boolean DEFAULT true,
  availability jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own doctors"
  ON doctors FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Doctor schedules (working hours)
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Doctor breaks and unavailability
CREATE TABLE IF NOT EXISTS doctor_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE,
  service_day date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  break_type text NOT NULL DEFAULT 'Break' CHECK (break_type IN ('Break', 'Lunch', 'Emergency', 'Unavailable')),
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Doctor indexes
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON doctors(specialization);
CREATE INDEX IF NOT EXISTS idx_schedule_doctor_day ON doctor_schedules(doctor_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_breaks_doctor_day ON doctor_breaks(doctor_id, service_day);

-- ========================================
-- 4. ADVANCED APPOINTMENT SYSTEM
-- ========================================

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE,
  
  -- Legacy fields (backward compatibility)
  appointment_datetime timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  
  -- Enhanced scheduling fields
  service_day date GENERATED ALWAYS AS (appointment_datetime::date) STORED,
  scheduled_start_time timestamptz GENERATED ALWAYS AS (appointment_datetime) STORED,
  estimated_start_time timestamptz DEFAULT NULL, -- Dynamic ETA
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  expected_duration_minutes integer DEFAULT 30,
  queue_position integer,
  
  -- Patient status
  patient_checked_in boolean DEFAULT false,
  checked_in_at timestamptz,
  
  -- Appointment details
  status text NOT NULL DEFAULT 'Scheduled' CHECK (status IN (
    'Scheduled', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show', 'Rescheduled'
  )),
  appointment_type text DEFAULT 'Consultation',
  symptoms text,
  diagnosis text,
  prescription text,
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own appointments"
  ON appointments FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Appointment indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_day ON appointments(doctor_id, service_day);
CREATE INDEX IF NOT EXISTS idx_appointments_queue ON appointments(doctor_id, service_day, queue_position);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_estimated_start ON appointments(estimated_start_time);

-- Unique constraint for queue positions
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_queue_unique 
  ON appointments(doctor_id, service_day, queue_position) 
  WHERE status IN ('Scheduled', 'Checked-In', 'In-Progress');

-- ========================================
-- 5. BILLING SYSTEM
-- ========================================

CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  bill_number text NOT NULL,
  
  -- Billing details
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  
  -- Payment tracking
  payment_status text DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Overdue', 'Cancelled')),
  payment_method text,
  payment_date timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bills"
  ON bills FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Billing indexes
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_patient ON bills(patient_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(created_at);

-- ========================================
-- 6. ROBUST JOB QUEUE SYSTEM
-- ========================================

CREATE TABLE IF NOT EXISTS job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN (
    'RECALCULATE_QUEUE', 'SEND_NOTIFICATION', 'PROCESS_CANCELLATION',
    'HANDLE_NO_SHOW', 'GENERATE_REMINDERS', 'CLEANUP_DATA'
  )),
  payload jsonb NOT NULL,
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  scheduled_for timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  error_message text,
  status text DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
  )),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Job queue indexes
CREATE INDEX IF NOT EXISTS idx_job_queue_processing ON job_queue(status, scheduled_for, priority);
CREATE INDEX IF NOT EXISTS idx_job_queue_retry ON job_queue(status, retry_count, max_retries);
CREATE INDEX IF NOT EXISTS idx_job_queue_type ON job_queue(job_type);

-- ========================================
-- 7. NOTIFICATION SYSTEM
-- ========================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  notification_type text NOT NULL CHECK (notification_type IN (
    'ETA_UPDATE', 'REMINDER_24H', 'REMINDER_2H', 'REMINDER_30MIN',
    'CANCELLATION', 'DELAY_ALERT', 'APPOINTMENT_CONFIRMED', 'CHECK_IN_REMINDER'
  )),
  delivery_channels text[] DEFAULT ARRAY['SMS'],
  message_template text NOT NULL,
  message_variables jsonb DEFAULT '{}',
  
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  delivery_status text DEFAULT 'PENDING' CHECK (delivery_status IN (
    'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'
  )),
  delivery_attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  delivery_response jsonb,
  error_message text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notification_queue_processing ON notification_queue(delivery_status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_clinic ON notification_queue(clinic_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_appointment ON notification_queue(appointment_id);

-- ========================================
-- 8. SYSTEM NOTIFICATIONS (USER-FACING)
-- ========================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  status text DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- ========================================
-- 9. AUDIT TRAIL SYSTEM
-- ========================================

CREATE TABLE IF NOT EXISTS appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'CREATED', 'CHECKED_IN', 'STARTED', 'COMPLETED', 'CANCELLED', 
    'NO_SHOW', 'RESCHEDULED', 'ETA_UPDATED', 'STATUS_CHANGED'
  )),
  old_values jsonb,
  new_values jsonb,
  triggered_by uuid REFERENCES auth.users(id),
  timestamp timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_events_appointment ON appointment_events(appointment_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON appointment_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON appointment_events(event_type);

-- ========================================
-- 10. DISTRIBUTED LOCKING
-- ========================================

CREATE TABLE IF NOT EXISTS queue_locks (
  lock_key text PRIMARY KEY,
  locked_at timestamptz DEFAULT now(),
  locked_by text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queue_locks_expires ON queue_locks(expires_at);

-- ========================================
-- 11. AUTOMATIC TRIGGERS
-- ========================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 12. PERFORMANCE OPTIMIZATIONS
-- ========================================

-- Enable database statistics for query optimization
ANALYZE;

-- Vacuum tables for better performance
VACUUM ANALYZE;
