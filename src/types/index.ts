import { AppointmentStatus, BillingStatus } from "../constants";

export interface Patient {
  id: string;
  user_id: string;
  name: string;
  age: number | null;
  gender: "Male" | "Female" | "Other" | null;
  contact: string;
  phone?: string; // Added phone property
  email: string | null;
  address: string | null;
  emergency_contact: string | null;
  medical_history: Record<string, unknown> | null;
  // New medical history fields
  allergies?: string[] | null;
  chronic_conditions?: string[] | null;
  medications?: string[] | null;
  previous_surgeries?: string[] | null;
  family_history?: string | null;
  additional_notes?: string | null;
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
  availability: Record<string, unknown> | null;
  consultation_fee: number;
  experience_years: number;
  created_at: string;
  updated_at: string;
}

// src/types/index.ts
export interface Appointment {
  id: string;
  user_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  status: AppointmentStatus;
  appointment_type?: string; // Added appointment type
  delay_minutes?: number; // Added delay minutes

  // Enhanced queue fields
  queue_position?: number;
  estimated_start_time?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  patient_checked_in?: boolean;
  checked_in_at?: string;

  // Emergency fields
  emergency_status?: boolean;
  emergency_reason?: string;

  notes?: string;
  symptoms?: string;
  diagnosis?: string;
  prescription?: string;
  created_at: string;
  updated_at: string;

  // Optional relational data
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
  status: BillingStatus;
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
