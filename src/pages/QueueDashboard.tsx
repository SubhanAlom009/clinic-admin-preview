import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Clock,
  User,
  CheckCircle,
  PlayCircle,
  Calendar,
  RefreshCw,
  Users,
  UserCheck,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import type { Appointment, Doctor } from "../types";

export function QueueDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(""); // Empty by default to show all dates
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchDoctors = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;

      const doctorsData = (data as Doctor[]) || [];
      setDoctors(doctorsData);
      // Don't auto-select a doctor - keep it as "All Doctors" by default
      // if (doctorsData && doctorsData.length > 0) {
      //   setSelectedDoctor(doctorsData[0].id);
      // }
    } catch (error) {
      console.error("Error fetching doctors:", error);
    }
  }, [user?.id]);

  const fetchQueue = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      console.log("Fetching queue with filters:", {
        selectedDoctor,
        selectedDate,
        user_id: user.id,
      });

      // Build query with optional filters
      let query = supabase
        .from("appointments")
        .select(
          `
          *,
          patient:patients(id, name, contact),
          doctor:doctors(id, name)
        `
        )
        .eq("user_id", user.id);

      // Remove the status filter temporarily to see if this is the issue
      // .in("status", ["Scheduled", "Checked-In", "In-Progress", "Completed"])

      // Apply doctor filter if selected
      if (selectedDoctor) {
        query = query.eq("doctor_id", selectedDoctor);
      }

      // Apply date filter if selected AND not empty
      if (selectedDate && selectedDate.trim() !== "") {
        query = query.eq("appointment_datetime::date", selectedDate);
      }

      query = query.order("appointment_datetime");

      const { data, error } = await query;

      console.log("Query result:", { data, error, count: data?.length });

      if (error) throw error;

      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctor, selectedDate, user?.id]);

  useEffect(() => {
    if (user) {
      fetchDoctors();
      fetchQueue(); // Load all appointments by default
    }
  }, [user, fetchDoctors, fetchQueue]);

  useEffect(() => {
    // Refetch when filters change
    fetchQueue();
  }, [selectedDoctor, selectedDate, fetchQueue]);

  const updateAppointmentStatus = async (
    id: string,
    status: string,
    updates: Record<string, string | boolean | null> = {}
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
        .update(updateData as any)
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

  const checkInPatient = (appointment: Appointment) => {
    updateAppointmentStatus(appointment.id, "Checked-In", {
      patient_checked_in: true,
      checked_in_at: new Date().toISOString(),
    });
  };

  const startAppointment = (appointment: Appointment) => {
    updateAppointmentStatus(appointment.id, "In-Progress", {
      actual_start_time: new Date().toISOString(),
    });
  };

  const completeAppointment = (appointment: Appointment) => {
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

  const getActionButton = (appointment: Appointment) => {
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

  const queueStats = {
    total: appointments.length,
    checkedIn: appointments.filter(
      (a) => a.patient_checked_in || a.status === "Checked-In"
    ).length,
    inProgress: appointments.filter((a) => a.status === "In-Progress").length,
    completed: appointments.filter((a) => a.status === "Completed").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Queue Management</h1>
        <p className="text-gray-600 mt-1">
          Real-time appointment queue and patient flow
        </p>
        {/* Debug info */}
        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
          Debug: Found {appointments.length} appointments | User:{" "}
          {user?.id?.slice(0, 8)}... | Filters: Doctor={selectedDoctor || "All"}
          , Date={selectedDate || "All dates"}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Doctor"
              name="doctor"
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              options={[
                { value: "", label: "All Doctors" },
                ...doctors.map((doctor) => ({
                  value: doctor.id,
                  label: `Dr. ${doctor.name}`,
                })),
              ]}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Filter
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                placeholder="Select date (leave empty for all dates)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate("")}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  All dates
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate(format(new Date(), "yyyy-MM-dd"))
                  }
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Today
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <Button
                onClick={fetchQueue}
                disabled={loading}
                className="w-full"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh Queue
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {queueStats.total}
                </p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {queueStats.checkedIn}
                </p>
                <p className="text-sm text-gray-600">Checked In</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <PlayCircle className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {queueStats.inProgress}
                </p>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">
                  {queueStats.completed}
                </p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No appointments found
            </h3>
            <p className="text-gray-500">
              {selectedDoctor || selectedDate
                ? "No appointments found for the selected filters."
                : "No appointments scheduled yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
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
                          {appointment.patient?.name || "Unknown Patient"}
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
                            new Date(appointment.appointment_datetime),
                            "HH:mm"
                          )}
                        </div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          {appointment.patient?.contact || "No contact"}
                        </div>
                        {appointment.doctor && (
                          <div className="flex items-center">
                            <UserCheck className="h-4 w-4 mr-1" />
                            Dr. {appointment.doctor.name}
                          </div>
                        )}
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
      )}
    </div>
  );
}
