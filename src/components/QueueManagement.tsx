import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  Clock,
  User,
  CheckCircle,
  PlayCircle,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import type { Appointment } from "../../types";

interface QueueAppointment extends Appointment {
  patient?: {
    id: string;
    name: string;
    contact: string;
  };
  doctor?: {
    id: string;
    name: string;
    specialization: string;
  };
}

interface Props {
  doctorId: string;
  selectedDate: string;
}

export function QueueManagement({ doctorId, selectedDate }: Props) {
  const [appointments, setAppointments] = useState<QueueAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchQueue = async () => {
    if (!user || !doctorId || !selectedDate) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          *,
          patient:patients(id, name, contact),
          doctor:doctors(id, name, specialization)
        `
        )
        .eq("doctor_id", doctorId)
        .eq("appointment_datetime::date", selectedDate)
        .in("status", ["Scheduled", "Checked-In", "In-Progress", "Completed"])
        .order("appointment_datetime");

      if (error) throw error;

      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    // Subscribe to appointment changes
    const subscription = supabase
      .channel(`queue-${doctorId}-${selectedDate}`)
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
      supabase.removeChannel(subscription);
    };
  }, [doctorId, selectedDate, user]);

  const updateAppointmentStatus = async (
    id: string,
    status: string,
    updates: Record<string, any> = {}
  ) => {
    try {
      setActionLoading(id);

      const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...updates,
      };

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      await fetchQueue();
    } catch (error) {
      console.error("Error updating appointment:", error);
      alert("Error updating appointment status");
    } finally {
      setActionLoading(null);
    }
  };

  const checkInPatient = (appointment: QueueAppointment) => {
    updateAppointmentStatus(appointment.id, "Checked-In", {
      patient_checked_in: true,
      checked_in_at: new Date().toISOString(),
    });
  };

  const startAppointment = (appointment: QueueAppointment) => {
    updateAppointmentStatus(appointment.id, "In-Progress", {
      actual_start_time: new Date().toISOString(),
    });
  };

  const completeAppointment = (appointment: QueueAppointment) => {
    updateAppointmentStatus(appointment.id, "Completed", {
      actual_end_time: new Date().toISOString(),
    });
  };

  const getStatusColor = (status: string, checkedIn: boolean) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "In-Progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Checked-In":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Scheduled":
        return checkedIn
          ? "bg-yellow-100 text-yellow-800 border-yellow-200"
          : "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getActionButton = (appointment: QueueAppointment) => {
    const isLoading = actionLoading === appointment.id;

    switch (appointment.status) {
      case "Scheduled":
        if (!appointment.patient_checked_in) {
          return (
            <Button
              size="sm"
              onClick={() => checkInPatient(appointment)}
              disabled={isLoading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Check In
            </Button>
          );
        }
        return (
          <Button
            size="sm"
            onClick={() => startAppointment(appointment)}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Start
          </Button>
        );
      case "Checked-In":
        return (
          <Button
            size="sm"
            onClick={() => startAppointment(appointment)}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Start
          </Button>
        );
      case "In-Progress":
        return (
          <Button
            size="sm"
            onClick={() => completeAppointment(appointment)}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Complete
          </Button>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No appointments scheduled
          </h3>
          <p className="text-gray-500">
            No appointments found for the selected date.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Queue for {format(parseISO(selectedDate), "MMMM d, yyyy")}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchQueue}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {appointments.map((appointment, index) => (
          <Card
            key={appointment.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        #{index + 1}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {appointment.patient?.name}
                      </h4>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          appointment.status,
                          appointment.patient_checked_in || false
                        )}`}
                      >
                        {appointment.status === "Scheduled" &&
                        appointment.patient_checked_in
                          ? "Checked-In"
                          : appointment.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {format(
                          parseISO(appointment.appointment_datetime),
                          "HH:mm"
                        )}
                      </div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        {appointment.patient?.contact}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {getActionButton(appointment)}
                </div>
              </div>

              {appointment.symptoms && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Symptoms:</span>{" "}
                    {appointment.symptoms}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
