export interface Patient {
  id: string;
  user_id: string;
  name: string;
  age: number | null;
  gender: "Male" | "Female" | "Other" | null;
  contact: string;
  email: string | null;
  address: string | null;
  emergency_contact: string | null;
  medical_history: any;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  user_id: string;
  name: string;
  specialization: string;
  qualifications: string | null;
  contact: string;
  email: string | null;
  availability: any;
  consultation_fee: number;
  experience_years: number;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  status:
    | "Scheduled"
    | "Checked-In"
    | "In-Progress"
    | "Completed"
    | "Cancelled"
    | "No-Show";
  notes: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  prescription: string | null;
  created_at: string;
  updated_at: string;
  // Enhanced scheduling fields
  estimated_start_time?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  queue_position?: number;
  patient_checked_in?: boolean;
  checked_in_at?: string;
  expected_duration_minutes?: number;
  patient?: Patient;
  doctor?: Doctor;
}

export interface Bill {
  id: string;
  user_id: string;
  patient_id: string;
  appointment_id: string | null;
  bill_number: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: "pending" | "paid" | "partially_paid" | "overdue" | "cancelled";
  payment_mode: "cash" | "card" | "upi" | "insurance" | "cheque" | null;
  payment_date: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patient?: Patient;
}

export interface Followup {
  id: string;
  user_id: string;
  patient_id: string;
  appointment_id: string;
  due_date: string;
  notes: string | null;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  patient?: Patient;
  appointment?: Appointment;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "appointment" | "payment" | "followup" | "system";
  title: string;
  message: string;
  status: "unread" | "read";
  priority: "low" | "normal" | "high";
  created_at: string;
}

export interface Profile {
  id: string;
  clinic_name: string;
  admin_name: string;
  contact_email: string;
  contact_phone: string | null;
  address: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  totalPatients: number;
  totalDoctors: number;
  todayAppointments: number;
  pendingBills: number;
  overdueFollowups: number;
}
