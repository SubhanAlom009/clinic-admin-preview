import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

interface RecentActivity {
  id: string;
  type: "appointment" | "payment" | "patient" | "doctor";
  title: string;
  timestamp: string;
}

export function useRecentActivity() {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchRecentActivity = async () => {
      try {
        const activities: RecentActivity[] = [];

        // Fetch recent appointments
        const { data: appointments } = await supabase
          .from("appointments")
          .select(
            `
            id,
            created_at,
            status,
            patient:patients(name),
            doctor:doctors(name)
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        appointments?.forEach((appointment) => {
          let activityTitle = "";
          switch (appointment.status) {
            case "scheduled":
              activityTitle = `Appointment scheduled for ${appointment.patient?.name} with ${appointment.doctor?.name}`;
              break;
            case "completed":
              activityTitle = `Appointment completed for ${appointment.patient?.name} with ${appointment.doctor?.name}`;
              break;
            case "cancelled":
              activityTitle = `Appointment cancelled for ${appointment.patient?.name} with ${appointment.doctor?.name}`;
              break;
            case "rescheduled":
              activityTitle = `Appointment rescheduled for ${appointment.patient?.name} with ${appointment.doctor?.name}`;
              break;
            case "no_show":
              activityTitle = `Patient ${appointment.patient?.name} did not show for appointment with ${appointment.doctor?.name}`;
              break;
            default:
              activityTitle = `Appointment ${appointment.status} for ${appointment.patient?.name} with ${appointment.doctor?.name}`;
          }

          activities.push({
            id: appointment.id,
            type: "appointment",
            title: activityTitle,
            timestamp: appointment.created_at,
          });
        });

        // Fetch recent bills/payments
        const { data: bills } = await supabase
          .from("bills")
          .select(
            `
            id,
            created_at,
            updated_at,
            status,
            total_amount,
            patient:patients(name)
          `
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(10);

        bills?.forEach((bill) => {
          const isPayment = bill.status === "paid";
          activities.push({
            id: bill.id,
            type: "payment",
            title: isPayment
              ? `Payment received from ${bill.patient?.name} - ₹${bill.total_amount}`
              : `Bill generated for ${bill.patient?.name} - ₹${bill.total_amount}`,
            timestamp: bill.updated_at,
          });
        });

        // Fetch recent patients
        const { data: patients } = await supabase
          .from("patients")
          .select("id, created_at, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        patients?.forEach((patient) => {
          activities.push({
            id: patient.id,
            type: "patient",
            title: `New patient registered: ${patient.name}`,
            timestamp: patient.created_at,
          });
        });

        // Fetch recent doctors
        const { data: doctors } = await supabase
          .from("doctors")
          .select("id, created_at, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        doctors?.forEach((doctor) => {
          activities.push({
            id: doctor.id,
            type: "doctor",
            title: `New doctor added: ${doctor.name}`,
            timestamp: doctor.created_at,
          });
        });

        // Sort all activities by timestamp (newest first)
        activities.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setActivities(activities.slice(0, 10)); // Keep only the 10 most recent
      } catch (error) {
        console.error("Error fetching recent activity:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();

    // Set up real-time subscriptions for all relevant tables
    const subscription = supabase
      .channel("recent-activity")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchRecentActivity()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchRecentActivity()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patients",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchRecentActivity()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doctors",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchRecentActivity()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return { activities, loading };
}
