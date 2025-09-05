/**
 * Appointment Service
 * Handles all appointment-related database operations
 */
import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";
import { AppointmentStatus, JobType, ERROR_MESSAGES } from "../constants";
import type { Appointment } from "../types";

export interface CreateAppointmentData {
  patient_id: string;
  doctor_id: string;
  appointment_datetime: string;
  service_day: string;
  expected_duration_minutes?: number;
  notes?: string;
  priority?: number;
}

export interface UpdateAppointmentData {
  status?: AppointmentStatus;
  notes?: string;
  diagnosis?: string;
  prescription?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  patient_checked_in?: boolean;
  checked_in_at?: string;
}

export class AppointmentService extends BaseService {
  static async getAppointments(filters?: {
    doctorId?: string;
    patientId?: string;
    date?: string;
    status?: AppointmentStatus;
    searchTerm?: string;
  }): Promise<ServiceResponse<Appointment[]>> {
    try {
      const user = await this.getCurrentUser();

      let query = supabase
        .from("appointments")
        .select(
          `
          *,
          patient:patients(*),
          doctor:doctors(*)
        `
        )
        .eq("user_id", user.id);

      // Apply filters
      if (filters?.doctorId) {
        query = query.eq("doctor_id", filters.doctorId);
      }

      if (filters?.patientId) {
        query = query.eq("patient_id", filters.patientId);
      }

      if (filters?.date) {
        const startOfDay = `${filters.date}T00:00:00.000Z`;
        const endOfDay = `${filters.date}T23:59:59.999Z`;
        query = query
          .gte("appointment_datetime", startOfDay)
          .lte("appointment_datetime", endOfDay);
      }

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      // Order by appointment_datetime
      query = query.order("appointment_datetime", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Apply search filter client-side for now (could be optimized with full-text search)
      let filteredData = data || [];
      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredData = filteredData.filter(
          (appointment: any) =>
            appointment.patient?.name?.toLowerCase().includes(searchLower) ||
            appointment.doctor?.name?.toLowerCase().includes(searchLower) ||
            appointment.patient?.phone?.includes(filters.searchTerm) ||
            appointment.id.toString().includes(filters.searchTerm)
        );
      }

      return { data: filteredData, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async createAppointment(
    appointmentData: CreateAppointmentData
  ): Promise<ServiceResponse<Appointment>> {
    try {
      const user = await this.getCurrentUser();

      this.validateRequired({
        patient_id: appointmentData.patient_id,
        doctor_id: appointmentData.doctor_id,
        appointment_datetime: appointmentData.appointment_datetime,
        service_day: appointmentData.service_day,
      });

      // Insert appointment with type assertion for Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          ...appointmentData,
          user_id: user.id,
          status: AppointmentStatus.SCHEDULED,
          expected_duration_minutes:
            appointmentData.expected_duration_minutes || 30,
        } as any)
        .select(
          `
          *,
          patient:patients(*),
          doctor:doctors(*)
        `
        )
        .single();

      if (error) throw error;

      // Enqueue recalculation job with type assertion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("job_queue").insert({
        job_type: JobType.RECALCULATE_QUEUE,
        payload: {
          doctor_id: appointmentData.doctor_id,
          service_day: appointmentData.service_day,
          trigger: "appointment_created",
        },
        priority: 3,
        scheduled_for: new Date().toISOString(),
      } as any);

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async updateAppointment(
    id: string,
    updateData: UpdateAppointmentData
  ): Promise<ServiceResponse<Appointment>> {
    try {
      const user = await this.getCurrentUser();

      // Get current appointment to check ownership and get service details
      const { data: currentAppt } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (!currentAppt) {
        throw new Error(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
      }

      // Update appointment
      const { data, error } = await supabase
        .from("appointments")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select(
          `
          *,
          patient:patients(*),
          doctor:doctors(*)
        `
        )
        .single();

      if (error) throw error;

      // If status changed, enqueue recalculation
      if (updateData.status && updateData.status !== currentAppt.status) {
        await supabase.from("job_queue").insert({
          job_type: JobType.RECALCULATE_QUEUE,
          payload: {
            doctor_id: currentAppt.doctor_id,
            service_day: currentAppt.service_day,
            trigger: "status_changed",
            old_status: currentAppt.status,
            new_status: updateData.status,
          },
          priority: 3,
          scheduled_for: new Date().toISOString(),
        });
      }

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async deleteAppointment(id: string): Promise<ServiceResponse<void>> {
    try {
      const user = await this.getCurrentUser();

      // Get appointment details before deletion
      const { data: appointment } = await supabase
        .from("appointments")
        .select("doctor_id, service_day")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (!appointment) {
        throw new Error(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
      }

      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      // Enqueue recalculation after deletion
      await supabase.from("job_queue").insert({
        job_type: JobType.RECALCULATE_QUEUE,
        payload: {
          doctor_id: appointment.doctor_id,
          service_day: appointment.service_day,
          trigger: "appointment_deleted",
        },
        priority: 3,
        scheduled_for: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async checkInPatient(
    appointmentId: string
  ): Promise<ServiceResponse<Appointment>> {
    return this.updateAppointment(appointmentId, {
      patient_checked_in: true,
      checked_in_at: new Date().toISOString(),
      status: AppointmentStatus.CHECKED_IN,
    });
  }

  static async startAppointment(
    appointmentId: string
  ): Promise<ServiceResponse<Appointment>> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.IN_PROGRESS,
      actual_start_time: new Date().toISOString(),
    });
  }

  static async completeAppointment(
    appointmentId: string,
    data: { diagnosis?: string; prescription?: string }
  ): Promise<ServiceResponse<Appointment>> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.COMPLETED,
      actual_end_time: new Date().toISOString(),
      ...data,
    });
  }

  static async rescheduleAppointment(
    appointmentId: string,
    newDateTime: string,
    newServiceDay: string
  ): Promise<ServiceResponse<Appointment>> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.RESCHEDULED,
      appointment_datetime: newDateTime,
      service_day: newServiceDay,
    });
  }
}
