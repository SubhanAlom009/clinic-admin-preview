import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { DashboardMetrics } from "../types";
import { format } from "date-fns";

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPatients: 0,
    totalDoctors: 0,
    todayAppointments: 0,
    pendingBills: 0,
    overdueFollowups: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchMetrics = async () => {
      try {
        const today = new Date();
        const todayDateString = format(today, "yyyy-MM-dd");

        console.log("Dashboard: Fetching metrics for user:", user.id);
        console.log("Dashboard: Today's date:", todayDateString);

        // Fetch all data in parallel
        const [
          patientsResult,
          doctorsResult,
          allAppointmentsResult,
          billsResult,
          followupsResult,
        ] = await Promise.all([
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),

          supabase
            .from("doctors")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),

          // FIXED: Get ALL appointments and filter manually
          supabase.from("appointments").select("*").eq("user_id", user.id),

          supabase
            .from("bills")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "pending"),

          supabase
            .from("followups")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "pending")
            .lt("due_date", todayDateString),
        ]);

        console.log("Dashboard: Raw results:", {
          patients: patientsResult.count,
          doctors: doctorsResult.count,
          allAppointments: allAppointmentsResult.data?.length,
          bills: billsResult.data?.length,
          followups: followupsResult.data?.length,
        });

        // FIXED: Filter today's appointments in JavaScript
        const todayAppointments =
          allAppointmentsResult.data?.filter((appointment) => {
            const appointmentDate = format(
              new Date(appointment.appointment_datetime),
              "yyyy-MM-dd"
            );
            const isToday = appointmentDate === todayDateString;

            if (isToday) {
              console.log(`Dashboard: Today's appointment found:`, {
                id: appointment.id,
                datetime: appointment.appointment_datetime,
                appointmentDate,
                todayDate: todayDateString,
                patient_id: appointment.patient_id,
                status: appointment.status,
              });
            }

            return isToday;
          }) || [];

        console.log(
          "Dashboard: Today's appointments filtered:",
          todayAppointments.length
        );

        const newMetrics = {
          totalPatients: patientsResult.count || 0,
          totalDoctors: doctorsResult.count || 0,
          todayAppointments: todayAppointments.length, // FIXED: Use filtered count
          pendingBills: billsResult.data?.length || 0,
          overdueFollowups: followupsResult.data?.length || 0,
        };

        console.log("Dashboard: Final metrics:", newMetrics);
        setMetrics(newMetrics);
      } catch (error) {
        console.error("Dashboard: Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Real-time subscriptions
    const subscription = supabase
      .channel("dashboard-metrics")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("Dashboard: Appointments changed, refetching...");
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return { metrics, loading };
}
