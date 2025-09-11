export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          clinic_name: string;
          admin_name: string;
          contact_email: string;
          contact_phone: string | null;
          address: string | null;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          clinic_name?: string;
          admin_name?: string;
          contact_email?: string;
          contact_phone?: string | null;
          address?: string | null;
          logo_url?: string | null;
        };
        Update: {
          clinic_name?: string;
          admin_name?: string;
          contact_email?: string;
          contact_phone?: string | null;
          address?: string | null;
          logo_url?: string | null;
          updated_at?: string;
        };
      };
      patients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          age: number | null;
          gender: string | null;
          contact: string;
          email: string | null;
          address: string | null;
          emergency_contact: string | null;
          medical_history: any;
          allergies: string[];
          medications: string[];
          previous_surgeries: string[];
          family_history: string;
          additional_notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          age?: number | null;
          gender?: string | null;
          contact: string;
          email?: string | null;
          address?: string | null;
          emergency_contact?: string | null;
          medical_history?: any;
          allergies?: string[];
          medications?: string[];
          previous_surgeries?: string[];
          family_history?: string;
          additional_notes?: string;
        };
        Update: {
          name?: string;
          age?: number | null;
          gender?: string | null;
          contact?: string;
          email?: string | null;
          address?: string | null;
          emergency_contact?: string | null;
          medical_history?: any;
          allergies?: string[];
          medications?: string[];
          previous_surgeries?: string[];
          family_history?: string;
          additional_notes?: string;
          updated_at?: string;
        };
      };
      doctors: {
        Row: {
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
        };
        Insert: {
          user_id: string;
          name: string;
          specialization: string;
          qualifications?: string | null;
          contact: string;
          email?: string | null;
          availability?: any;
          consultation_fee?: number;
          experience_years?: number;
        };
        Update: {
          name?: string;
          specialization?: string;
          qualifications?: string | null;
          contact?: string;
          email?: string | null;
          availability?: any;
          consultation_fee?: number;
          experience_years?: number;
          updated_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          user_id: string;
          patient_id: string;
          doctor_id: string;
          appointment_datetime: string;
          duration_minutes: number;
          status: string;
          appointment_type: string | null;
          delay_minutes: number | null;
          notes: string | null;
          symptoms: string | null;
          diagnosis: string | null;
          prescription: string | null;

          // enhanced queue fields
          queue_position: number | null;
          estimated_start_time: string | null;
          actual_start_time: string | null;
          actual_end_time: string | null;
          patient_checked_in: boolean | null;
          checked_in_at: string | null;

          // emergency fields
          emergency_status: boolean | null;
          emergency_reason: string | null;

          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          patient_id: string;
          doctor_id: string;
          appointment_datetime: string;
          duration_minutes?: number;
          status?: string;
          appointment_type?: string | null;
          delay_minutes?: number | null;
          notes?: string | null;
          symptoms?: string | null;
          diagnosis?: string | null;
          prescription?: string | null;

          // Enhanced fields for insert
          queue_position?: number | null;
          estimated_start_time?: string | null;
          actual_start_time?: string | null;
          actual_end_time?: string | null;
          patient_checked_in?: boolean | null;
          checked_in_at?: string | null;

          // Emergency fields for insert
          emergency_status?: boolean | null;
          emergency_reason?: string | null;
        };
        Update: {
          appointment_datetime?: string;
          duration_minutes?: number;
          status?: string;
          appointment_type?: string | null;
          delay_minutes?: number | null;
          notes?: string | null;
          symptoms?: string | null;
          diagnosis?: string | null;
          prescription?: string | null;

          // Enhanced fields for update
          queue_position?: number | null;
          estimated_start_time?: string | null;
          actual_start_time?: string | null;
          actual_end_time?: string | null;
          patient_checked_in?: boolean | null;
          checked_in_at?: string | null;

          // Emergency fields for update
          emergency_status?: boolean | null;
          emergency_reason?: string | null;

          updated_at?: string;
        };
      };
      bills: {
        Row: {
          id: string;
          user_id: string;
          patient_id: string;
          appointment_id: string | null;
          bill_number: string;
          amount: number;
          tax_amount: number;
          total_amount: number;
          status: string;
          payment_mode: string | null;
          payment_date: string | null;
          due_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          patient_id: string;
          appointment_id?: string | null;
          bill_number: string;
          amount: number;
          tax_amount?: number;
          total_amount: number;
          status?: string;
          payment_mode?: string | null;
          payment_date?: string | null;
          due_date?: string | null;
          notes?: string | null;
        };
        Update: {
          amount?: number;
          tax_amount?: number;
          total_amount?: number;
          status?: string;
          payment_mode?: string | null;
          payment_date?: string | null;
          due_date?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      followups: {
        Row: {
          id: string;
          user_id: string;
          patient_id: string;
          appointment_id: string;
          due_date: string;
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          patient_id: string;
          appointment_id: string;
          due_date: string;
          notes?: string | null;
          status?: string;
        };
        Update: {
          due_date?: string;
          notes?: string | null;
          status?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          status: string;
          priority: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type: string;
          title: string;
          message: string;
          status?: string;
          priority?: string;
        };
        Update: {
          status?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          table_name: string;
          record_id: string | null;
          old_data: any | null;
          new_data: any | null;
          timestamp: string;
        };
        Insert: {
          user_id: string;
          action: string;
          table_name: string;
          record_id?: string | null;
          old_data?: any | null;
          new_data?: any | null;
        };
      };
    };
  };
}
