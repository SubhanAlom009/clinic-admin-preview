// Queue Management Hook
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { Appointment, Patient, Doctor } from "../types";

export interface QueueAppointment extends Appointment {
  patient?: Patient;
  doctor?: Doctor;
}

export interface QueueMetrics {
  totalAppointments: number;
  checkedInCount: number;
  inProgressCount: number;
  completedCount: number;
  averageWaitTime: number;
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

  const calculateAverageWaitTime = (
    appointments: QueueAppointment[]
  ): number => {
    const completedWithTimes = appointments.filter(
      (a) =>
        a.status === "Completed" &&
        a.actual_start_time &&
        a.estimated_start_time
    );

    if (completedWithTimes.length === 0) return 0;

    const totalWaitTime = completedWithTimes.reduce((sum, appointment) => {
      const estimatedStart = new Date(appointment.estimated_start_time!);
      const actualStart = new Date(appointment.actual_start_time!);
      const waitTime = Math.max(
        0,
        actualStart.getTime() - estimatedStart.getTime()
      );
      return sum + waitTime;
    }, 0);

    return Math.round(totalWaitTime / completedWithTimes.length / (1000 * 60)); // Convert to minutes
  };

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
        .in("status", ["Scheduled", "Checked-In", "In-Progress", "Completed"])
        .order("queue_position");

      if (fetchError) throw fetchError;

      const queueData = data || [];
      setQueue(queueData);

      // Calculate metrics
      const newMetrics: QueueMetrics = {
        totalAppointments: queueData.length,
        checkedInCount: queueData.filter((a) => a.patient_checked_in).length,
        inProgressCount: queueData.filter((a) => a.status === "In-Progress")
          .length,
        completedCount: queueData.filter((a) => a.status === "Completed")
          .length,
        averageWaitTime: calculateAverageWaitTime(queueData),
      };
      setMetrics(newMetrics);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error fetching queue:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user, doctorId, serviceDay]);

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
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  // Queue management functions
  const checkInPatient = async (appointmentId: string) => {
    try {
      const { data, error } = (await supabase.rpc("checkin_patient", {
        p_appointment_id: appointmentId,
      })) as { data: { success: boolean; error?: string }; error: any };

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to check in patient");
      }

      await fetchQueue();
      return data;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error checking in patient:", err);
      throw new Error(errorMessage);
    }
  };

  const startAppointment = async (
    appointmentId: string,
    actualStartTime?: string
  ) => {
    try {
      const { data, error } = (await supabase.rpc("start_appointment", {
        p_appointment_id: appointmentId,
        p_actual_start_time: actualStartTime || new Date().toISOString(),
      })) as { data: { success: boolean; error?: string }; error: any };

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to start appointment");
      }

      await fetchQueue();
      return data;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error starting appointment:", err);
      throw new Error(errorMessage);
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
      const { data, error } = (await supabase.rpc("complete_appointment", {
        p_appointment_id: appointmentId,
        p_actual_end_time: details.actualEndTime || new Date().toISOString(),
        p_diagnosis: details.diagnosis,
        p_prescription: details.prescription,
        p_notes: details.notes,
      })) as { data: { success: boolean; error?: string }; error: any };

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to complete appointment");
      }

      await fetchQueue();
      return data;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error completing appointment:", err);
      throw new Error(errorMessage);
    }
  };

  const cancelAppointment = async (appointmentId: string, reason?: string) => {
    try {
      const { data, error } = (await supabase.rpc("cancel_appointment", {
        p_appointment_id: appointmentId,
        p_reason: reason,
      })) as { data: { success: boolean; error?: string }; error: any };

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to cancel appointment");
      }

      await fetchQueue();
      return data;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error cancelling appointment:", err);
      throw new Error(errorMessage);
    }
  };

  const recalculateQueue = async (startFromPosition: number = 1) => {
    try {
      const { data, error } = (await supabase.rpc("recalculate_queue", {
        p_doctor_id: doctorId,
        p_service_day: serviceDay,
        p_start_from_position: startFromPosition,
      })) as { data: any; error: any };

      if (error) throw error;

      await fetchQueue();
      return data;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error recalculating queue:", err);
      throw new Error(errorMessage);
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
      refresh: fetchQueue,
    },
  };
};
