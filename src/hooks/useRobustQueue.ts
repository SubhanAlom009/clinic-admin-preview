import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

interface QueueJob {
  id: string;
  job_type: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  priority: number;
  retry_count: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface QueueMetrics {
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  lastProcessedAt?: string;
}

interface NotificationStatus {
  pending: number;
  sent: number;
  failed: number;
}

export function useRobustQueue() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics>({
    pendingJobs: 0,
    runningJobs: 0,
    failedJobs: 0,
    avgProcessingTime: 0,
  });
  const [notifications, setNotifications] = useState<NotificationStatus>({
    pending: 0,
    sent: 0,
    failed: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch queue metrics
  const fetchMetrics = useCallback(async () => {
    if (!user) return;

    try {
      // Get job statistics
      const { data: jobStats } = await supabase
        .from("job_queue")
        .select("status, created_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (jobStats) {
        const pending = jobStats.filter((j) => j.status === "PENDING").length;
        const running = jobStats.filter((j) => j.status === "RUNNING").length;
        const failed = jobStats.filter((j) => j.status === "FAILED").length;

        // Calculate average processing time for completed jobs
        const completed = jobStats.filter(
          (j) => j.status === "COMPLETED" && j.completed_at
        );
        const avgTime =
          completed.length > 0
            ? completed.reduce((sum, job) => {
                const start = new Date(job.created_at).getTime();
                const end = new Date(job.completed_at!).getTime();
                return sum + (end - start);
              }, 0) /
              completed.length /
              1000 // Convert to seconds
            : 0;

        setMetrics({
          pendingJobs: pending,
          runningJobs: running,
          failedJobs: failed,
          avgProcessingTime: Math.round(avgTime),
          lastProcessedAt: completed[0]?.completed_at,
        });
      }

      // Get notification statistics
      const { data: notificationStats } = await supabase
        .from("notification_queue")
        .select("delivery_status")
        .eq("clinic_id", user.id);

      if (notificationStats) {
        const notifPending = notificationStats.filter(
          (n) => n.delivery_status === "PENDING"
        ).length;
        const notifSent = notificationStats.filter(
          (n) => n.delivery_status === "SENT"
        ).length;
        const notifFailed = notificationStats.filter(
          (n) => n.delivery_status === "FAILED"
        ).length;

        setNotifications({
          pending: notifPending,
          sent: notifSent,
          failed: notifFailed,
        });
      }
    } catch (error) {
      console.error("Error fetching queue metrics:", error);
    }
  }, [user]);

  // Fetch recent jobs
  const fetchJobs = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("job_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  }, [user]);

  // Queue a job
  const queueJob = useCallback(
    async (jobType: string, payload: Record<string, any>, priority = 5) => {
      try {
        const { data, error } = await supabase
          .from("job_queue")
          .insert({
            job_type: jobType,
            payload,
            priority,
          } as any)
          .select()
          .single();

        if (error) throw error;

        // Refresh metrics after queuing
        await fetchMetrics();
        await fetchJobs();

        return { success: true, jobId: data.id };
      } catch (error: any) {
        console.error("Error queuing job:", error);
        return { success: false, error: error.message };
      }
    },
    [fetchMetrics, fetchJobs]
  );

  // Trigger queue recalculation
  const recalculateQueue = useCallback(
    async (
      doctorId: string,
      serviceDay: string,
      startFromPosition = 1,
      priority = 3 // High priority for queue recalculations
    ) => {
      return queueJob(
        "RECALCULATE_QUEUE",
        {
          doctor_id: doctorId,
          service_day: serviceDay,
          start_from_position: startFromPosition,
        },
        priority
      );
    },
    [queueJob]
  );

  // Send notification
  const queueNotification = useCallback(
    async (
      appointmentId: string,
      patientId: string,
      notificationType: string,
      messageContent: Record<string, any>
    ) => {
      try {
        const { error } = await supabase.from("notification_queue").insert({
          appointment_id: appointmentId,
          patient_id: patientId,
          clinic_id: user?.id,
          notification_type: notificationType,
          delivery_channels: ["SMS"],
          message_template: "Your appointment has been updated: {{message}}",
          message_variables: messageContent,
          scheduled_for: new Date().toISOString(),
        });

        if (error) throw error;

        await fetchMetrics();
        return { success: true };
      } catch (error) {
        console.error("Error queuing notification:", error);
        return { success: false, error: error.message };
      }
    },
    [user, fetchMetrics]
  );

  // Manual queue processing trigger
  const processQueue = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      // Call the Edge Function to process queue
      const { data, error } = await supabase.functions.invoke(
        "queue-processor"
      );

      if (error) throw error;

      console.log("Queue processing result:", data);

      // Refresh data after processing
      await fetchMetrics();
      await fetchJobs();

      return { success: true, result: data };
    } catch (error) {
      console.error("Error processing queue:", error);
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, fetchMetrics, fetchJobs]);

  // Retry failed jobs
  const retryFailedJobs = useCallback(async () => {
    try {
      const { error } = await supabase
        .from("job_queue")
        .update({
          status: "PENDING",
          retry_count: 0,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("status", "FAILED")
        .lt("retry_count", 3); // Only retry jobs that haven't exceeded max retries

      if (error) throw error;

      await fetchMetrics();
      await fetchJobs();

      return { success: true };
    } catch (error) {
      console.error("Error retrying failed jobs:", error);
      return { success: false, error: error.message };
    }
  }, [fetchMetrics, fetchJobs]);

  // Cancel job
  const cancelJob = useCallback(
    async (jobId: string) => {
      try {
        const { error } = await supabase
          .from("job_queue")
          .update({
            status: "CANCELLED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("status", "PENDING"); // Can only cancel pending jobs

        if (error) throw error;

        await fetchMetrics();
        await fetchJobs();

        return { success: true };
      } catch (error) {
        console.error("Error cancelling job:", error);
        return { success: false, error: error.message };
      }
    },
    [fetchMetrics, fetchJobs]
  );

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    fetchMetrics();
    fetchJobs();

    // Subscribe to job queue changes
    const jobSubscription = supabase
      .channel("job_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_queue",
        },
        () => {
          fetchMetrics();
          fetchJobs();
        }
      )
      .subscribe();

    // Subscribe to notification queue changes
    const notificationSubscription = supabase
      .channel("notification_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_queue",
          filter: `clinic_id=eq.${user.id}`,
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      jobSubscription.unsubscribe();
      notificationSubscription.unsubscribe();
    };
  }, [user, fetchMetrics, fetchJobs]);

  // Auto-process queue every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isProcessing && metrics.pendingJobs > 0) {
        processQueue();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isProcessing, metrics.pendingJobs, processQueue]);

  return {
    // Data
    jobs,
    metrics,
    notifications,
    isProcessing,

    // Actions
    queueJob,
    recalculateQueue,
    queueNotification,
    processQueue,
    retryFailedJobs,
    cancelJob,

    // Utilities
    refresh: () => {
      fetchMetrics();
      fetchJobs();
    },
  };
}
