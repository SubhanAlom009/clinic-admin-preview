// Queue Management Hook
import { useState, useEffect } from "react";
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

  const fetchQueue = React.useCallback(async () => {
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
      const metrics: QueueMetrics = {
        totalAppointments: queueData.length,
        checkedInCount: queueData.filter((a) => a.patient_checked_in).length,
        inProgressCount: queueData.filter((a) => a.status === "In-Progress")
          .length,
        completedCount: queueData.filter((a) => a.status === "Completed")
          .length,
        averageWaitTime: calculateAverageWaitTime(queueData),
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
      refresh: fetchQueue,
    },
  };
};
