// Queue Management Hook
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { Appointment, Patient, Doctor } from "../types";
import { AppointmentStatus } from "../constants";

export interface QueueAppointment extends Appointment {
  patient?: Patient;
  doctor?: Doctor;
  //Computed fields
  waitingTime?: number;
  estimatedDelay?: number;
  priority?: "normal" | "urgent" | "emergency";
}

export interface QueueMetrics {
  totalAppointments: number;
  checkedInCount: number;
  inProgressCount: number;
  completedCount: number;
  averageWaitTime: number;
  estimatedCompletionTime?: string;
  totalDelayMinutes?: number;
}

export const useLiveQueue = (doctorId: string, serviceDay: string) => {
  const [queue, setQueue] = useState<QueueAppointment[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics>({
    totalAppointments: 0,
    checkedInCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    averageWaitTime: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchQueue = useCallback(async () => {
    if (!user || !doctorId || !serviceDay) return;

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select(
          `
          *,
          patient:patients(*),
          doctor:doctors(*)
        `
        )
        .eq("doctor_id", doctorId)
        .eq("appointment_datetime::date", serviceDay)
        .in("status", [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.IN_PROGRESS,
          AppointmentStatus.COMPLETED,
        ])
        .order("queue_position");

      if (fetchError) throw fetchError;

      const enhancedQueue = (data || []).map((appointment, index) => ({
        ...appointment,
        waitingTime: calculateWaitingTime(appointment),
        estimatedDelay: calculateEstimatedDelay(appointment),
        priority: determinePriority(appointment),
      }));

      setQueue(enhancedQueue);

      // Calculate metrics
      const metrics: QueueMetrics = {
        totalAppointments: enhancedQueue.length,
        checkedInCount: enhancedQueue.filter((a) => a.patient_checked_in)
          .length,
        inProgressCount: enhancedQueue.filter(
          (a) => a.status === AppointmentStatus.IN_PROGRESS
        ).length,
        completedCount: enhancedQueue.filter(
          (a) => a.status === AppointmentStatus.COMPLETED
        ).length,
        averageWaitTime: calculateAverageWaitTime(enhancedQueue),
        estimatedCompletionTime: calculateEstimatedCompletion(enhancedQueue),
        totalDelayMinutes: calculateTotalDelay(enhancedQueue),
      };
      setMetrics(metrics);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error fetching queue:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user, doctorId, serviceDay]);

  const calculateWaitingTime = (appointment: QueueAppointment): number => {
    if (!appointment.checked_in_at || !appointment.actual_start_time) return 0;

    const checkedIn = new Date(appointment.checked_in_at);
    const started = new Date(appointment.actual_start_time);
    return Math.max(
      0,
      Math.floor((started.getTime() - checkedIn.getTime()) / (1000 * 60))
    );
  };

  const calculateEstimatedDelay = (appointment: QueueAppointment): number => {
    if (!appointment.estimated_start_time) return 0;

    const estimated = new Date(appointment.estimated_start_time);
    const scheduled = new Date(appointment.appointment_datetime);
    return Math.max(
      0,
      Math.floor((estimated.getTime() - scheduled.getTime()) / (1000 * 60))
    );
  };

  const determinePriority = (
    appointment: QueueAppointment
  ): "normal" | "urgent" | "emergency" => {
    const symptoms = appointment.symptoms?.toLowerCase() || "";
    if (symptoms.includes("emergency") || symptoms.includes("critical"))
      return "emergency";
    if (symptoms.includes("urgent") || symptoms.includes("severe"))
      return "urgent";
    return "normal";
  };

  const calculateEstimatedCompletion = (
    appointments: QueueAppointment[]
  ): string => {
    const inProgress = appointments.find(
      (a) => a.status === AppointmentStatus.IN_PROGRESS
    );
    if (!inProgress) return "No active appointment";

    const remaining = appointments.filter(
      (a) =>
        a.queue_position &&
        inProgress.queue_position &&
        a.queue_position > inProgress.queue_position
    );

    const totalMinutes = remaining.reduce(
      (sum, apt) => sum + apt.duration_minutes,
      0
    );
    const estimatedEnd = new Date(Date.now() + totalMinutes * 60000);

    return estimatedEnd.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const calculateTotalDelay = (appointments: QueueAppointment[]): number => {
    return appointments.reduce(
      (total, apt) => total + (apt.estimatedDelay || 0),
      0
    );
  };

  const calculateAverageWaitTime = (
    appointments: QueueAppointment[]
  ): number => {
    const waitTimes = appointments
      .map((a) => a.waitingTime || 0)
      .filter((time) => time > 0);

    if (waitTimes.length === 0) return 0;
    return Math.round(
      waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
    );
  };

  const handleDoctorDelay = async (delayMinutes: number) => {
    try {
      // This will trigger the database function to update all appointments
      const { data, error } = await supabase.rpc("add_doctor_delay", {
        p_doctor_id: doctorId,
        p_service_date: serviceDay,
        p_delay_minutes: delayMinutes,
      });

      if (error) throw error;

      await fetchQueue(); // Refresh the queue
      return { success: true, data };
    } catch (err: any) {
      console.error("Error applying doctor delay:", err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchQueue();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`queue:${doctorId}:${serviceDay}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          console.log("Queue change detected:", payload);
          fetchQueue();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_events",
        },
        (payload) => {
          console.log("Appointment event:", payload);
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, serviceDay, user]);

  // Queue management functions
  const checkInPatient = async (appointmentId: string) => {
    try {
      const { data, error } = await supabase.rpc("checkin_patient", {
        p_appointment_id: appointmentId,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to check in patient");
      }

      await fetchQueue(); // Refresh queue
      return data;
    } catch (err: any) {
      console.error("Error checking in patient:", err);
      throw err;
    }
  };

  const startAppointment = async (
    appointmentId: string,
    actualStartTime?: string
  ) => {
    try {
      const { data, error } = await supabase.rpc("start_appointment", {
        p_appointment_id: appointmentId,
        p_actual_start_time: actualStartTime || new Date().toISOString(),
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to start appointment");
      }

      await fetchQueue(); // Refresh queue
      return data;
    } catch (err: any) {
      console.error("Error starting appointment:", err);
      throw err;
    }
  };

  const completeAppointment = async (
    appointmentId: string,
    details: {
      actualEndTime?: string;
      diagnosis?: string;
      prescription?: string;
      notes?: string;
    }
  ) => {
    try {
      const { data, error } = await supabase.rpc("complete_appointment", {
        p_appointment_id: appointmentId,
        p_actual_end_time: details.actualEndTime || new Date().toISOString(),
        p_diagnosis: details.diagnosis,
        p_prescription: details.prescription,
        p_notes: details.notes,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to complete appointment");
      }

      await fetchQueue(); // Refresh queue
      return data;
    } catch (err: any) {
      console.error("Error completing appointment:", err);
      throw err;
    }
  };

  const cancelAppointment = async (appointmentId: string, reason?: string) => {
    try {
      const { data, error } = await supabase.rpc("cancel_appointment", {
        p_appointment_id: appointmentId,
        p_reason: reason,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to cancel appointment");
      }

      await fetchQueue(); // Refresh queue
      return data;
    } catch (err: any) {
      console.error("Error cancelling appointment:", err);
      throw err;
    }
  };

  const recalculateQueue = async (startFromPosition: number = 1) => {
    try {
      const { data, error } = await supabase.rpc("recalculate_queue", {
        p_doctor_id: doctorId,
        p_service_day: serviceDay,
        p_start_from_position: startFromPosition,
      });

      if (error) throw error;

      await fetchQueue(); // Refresh queue
      return data;
    } catch (err: any) {
      console.error("Error recalculating queue:", err);
      throw err;
    }
  };

  return {
    queue,
    metrics,
    loading,
    error,
    actions: {
      checkInPatient,
      startAppointment,
      completeAppointment,
      cancelAppointment,
      recalculateQueue,
      handleDoctorDelay,
      refresh: fetchQueue,
    },
  };
};
