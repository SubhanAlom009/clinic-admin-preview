/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  UserCheck,
  Calendar,
  Search,
  RefreshCw,
  Activity,
  Users,
  CheckCircle,
  PlayCircle,
  User,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Card, CardContent } from "../ui/Card";
import { MetricCard } from "../ui/MetricCard";
import { AppointmentService } from "../../services/AppointmentService";
import { AppointmentStatus } from "../../constants";
import { useAuth } from "../../hooks/useAuth";
import { Appointment, Doctor } from "../../types";
import { format } from "date-fns";
import { supabase } from "../../lib/supabase";
import { QueueManagementModal } from "./QueueManagementModal";
import { toast } from "sonner";

export function QueueTab() {
  const [queueData, setQueueData] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [queueManagementOpen, setQueueManagementOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const { user } = useAuth();

  // Auto-select first doctor when doctors are loaded
  useEffect(() => {
    if (doctors.length > 0 && !selectedDoctor) {
      setSelectedDoctor(doctors[0].id);
    }
  }, [doctors, selectedDoctor]);

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
    } catch (error) {
      console.error("Error fetching doctors:", error);
    }
  }, [user?.id]);

  const fetchQueue = useCallback(async () => {
    if (!user?.id || !selectedDoctor) return;

    try {
      setLoading(true);

      console.log("Fetching queue with filters:", {
        selectedDoctor,
        selectedDate,
        user_id: user.id,
      });

      // Use AppointmentService - always filter by doctor in queue tab
      const response = await AppointmentService.getAppointments({
        doctorId: selectedDoctor, // Always require doctor selection
        date:
          selectedDate && selectedDate.trim() !== "" ? selectedDate : undefined,
        searchTerm: searchTerm || undefined,
      });

      console.log("Service response:", response);

      if (response.success && response.data) {
        setQueueData(response.data);
      } else {
        console.error("Error from service:", response.error);
        setQueueData([]);
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
      setQueueData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDoctor, selectedDate, user?.id, searchTerm]);

  useEffect(() => {
    if (user) {
      fetchDoctors();
      fetchQueue();
    }
  }, [user, fetchDoctors, fetchQueue]);

  useEffect(() => {
    fetchQueue();
  }, [selectedDoctor, selectedDate, searchTerm, fetchQueue]);

  // Real-time subscription for queue updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`queue-updates-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Real-time queue update:", payload);
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchQueue]);

  // Queue recalculation function with toast notifications
  const recalculateQueuePositions = async (
    doctorId: string,
    date: string,
    showToast: boolean = true
  ) => {
    if (showToast) {
      toast.loading("Recalculating queue positions...", { id: "queue-recalc" });
    }

    try {
      const startTime = new Date(`${date}T00:00:00`);
      const endTime = new Date(`${date}T23:59:59`);

      // Fetch all active appointments for the doctor on this date (excluding completed)
      const { data: appointments, error: fetchError } = await (supabase as any)
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorId)
        .gte("appointment_datetime", startTime.toISOString())
        .lt("appointment_datetime", endTime.toISOString())
        .neq("status", AppointmentStatus.COMPLETED) // Exclude completed appointments
        .order("emergency_status", { ascending: false }) // Emergency first
        .order("appointment_datetime", { ascending: true }); // Then by time

      if (fetchError) throw fetchError;

      if (!appointments || appointments.length === 0) {
        if (showToast) {
          toast.success("Queue updated (no active appointments)", {
            id: "queue-recalc",
          });
        }
        return;
      }

      // Recalculate queue positions properly
      let estimatedTime = new Date(`${date}T09:00:00`); // Start at 9 AM

      const updates = appointments.map((appointment: any, index: number) => {
        const queuePosition = index + 1; // Sequential numbering: 1, 2, 3, 4...
        const estimatedStartTime = new Date(estimatedTime);

        // Add appointment duration to estimated time for next appointment
        estimatedTime = new Date(
          estimatedStartTime.getTime() +
            (appointment.duration_minutes || 30) * 60000
        );

        return (supabase as any)
          .from("appointments")
          .update({
            queue_position: queuePosition,
            estimated_start_time: estimatedStartTime.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", appointment.id);
      });

      await Promise.all(updates);

      if (showToast) {
        toast.success(
          `Queue recalculated for ${appointments.length} active appointments`,
          { id: "queue-recalc" }
        );
      }
    } catch (error) {
      console.error("Error recalculating queue positions:", error);
      if (showToast) {
        toast.error("Failed to recalculate queue positions", {
          id: "queue-recalc",
        });
      }
    }
  };

  const updateAppointmentStatus = async (
    id: string,
    status: string,
    updates: Record<string, string | boolean | null> = {},
    appointment?: Appointment
  ) => {
    try {
      setActionLoading(id);

      const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...updates,
      };

      const { error } = await (supabase as any)
        .from("appointments")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      // Trigger queue recalculation for status changes that affect queue order
      if (
        appointment &&
        (status === AppointmentStatus.IN_PROGRESS ||
          status === AppointmentStatus.CHECKED_IN)
      ) {
        const appointmentDate = new Date(appointment.appointment_datetime)
          .toISOString()
          .split("T")[0];
        // Recalculate without toast for minor status changes
        await recalculateQueuePositions(
          appointment.doctor_id,
          appointmentDate,
          false
        );
      }

      await fetchQueue();
    } catch (error) {
      console.error("Error updating appointment:", error);
      alert("Error updating appointment status");
    } finally {
      setActionLoading(null);
    }
  };

  const checkInPatient = (appointment: Appointment) => {
    updateAppointmentStatus(
      appointment.id,
      AppointmentStatus.CHECKED_IN,
      {
        patient_checked_in: true,
        checked_in_at: new Date().toISOString(),
      },
      appointment
    );
  };

  const startAppointment = (appointment: Appointment) => {
    updateAppointmentStatus(
      appointment.id,
      AppointmentStatus.IN_PROGRESS,
      {
        actual_start_time: new Date().toISOString(),
      },
      appointment
    );
  };

  const completeAppointment = async (appointment: Appointment) => {
    try {
      setActionLoading(appointment.id);

      const updateData = {
        status: AppointmentStatus.COMPLETED,
        actual_end_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("appointments")
        .update(updateData)
        .eq("id", appointment.id);

      if (error) throw error;

      // Automatically recalculate queue positions after completion
      if (appointment.doctor_id && appointment.appointment_datetime) {
        const appointmentDate = new Date(appointment.appointment_datetime)
          .toISOString()
          .split("T")[0];
        await recalculateQueuePositions(
          appointment.doctor_id,
          appointmentDate,
          true
        );
      }

      await fetchQueue();
    } catch (error) {
      console.error("Error completing appointment:", error);
      alert("Error completing appointment");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string, checkedIn: boolean) => {
    switch (status) {
      case AppointmentStatus.COMPLETED:
        return "bg-green-100 text-green-800 border-green-200";
      case AppointmentStatus.IN_PROGRESS:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case AppointmentStatus.CHECKED_IN:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case AppointmentStatus.SCHEDULED:
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
      case AppointmentStatus.SCHEDULED:
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
      case AppointmentStatus.CHECKED_IN:
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
      case AppointmentStatus.IN_PROGRESS:
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
      case AppointmentStatus.COMPLETED:
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

  const filteredQueue = queueData.filter((appointment) => {
    const patient = appointment.patient;
    const doctor = appointment.doctor;

    const searchMatch =
      !searchTerm ||
      patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.id.toString().includes(searchTerm);

    const matchesDoctor =
      selectedDoctor === "" || appointment.doctor?.id === selectedDoctor;

    return searchMatch && matchesDoctor;
  });

  // Separate active and completed appointments
  const activeAppointments = filteredQueue.filter(
    (appointment) => appointment.status !== AppointmentStatus.COMPLETED
  );

  const completedAppointments = filteredQueue.filter(
    (appointment) => appointment.status === AppointmentStatus.COMPLETED
  );

  // Get current appointments based on active tab
  const currentAppointments =
    activeTab === "active" ? activeAppointments : completedAppointments;

  const queueStats = {
    total: activeAppointments.length, // Only count active appointments in queue
    checkedIn: activeAppointments.filter(
      (a) => a.patient_checked_in || a.status === AppointmentStatus.CHECKED_IN
    ).length,
    inProgress: activeAppointments.filter(
      (a) => a.status === AppointmentStatus.IN_PROGRESS
    ).length,
    completed: completedAppointments.length, // Completed appointments count
  };

  const stats = {
    scheduled: activeAppointments.filter(
      (a) => a.status === AppointmentStatus.SCHEDULED
    ).length,
    inProgress: activeAppointments.filter(
      (a) => a.status === AppointmentStatus.IN_PROGRESS
    ).length,
    completed: completedAppointments.length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total"
          value={queueStats.total}
          icon={Users}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Checked In"
          value={queueStats.checkedIn}
          icon={CheckCircle}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="In Progress"
          value={queueStats.inProgress}
          icon={Activity}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Completed"
          value={queueStats.completed}
          icon={CheckCircle}
          trend={{ value: 0, isPositive: true }}
        />
      </div>

      {/* Tab Navigation */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-4">
            {/* Tab Buttons */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("active")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === "active"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Active Queue ({activeAppointments.length})
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === "completed"
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Completed ({completedAppointments.length})
              </button>
            </div>

            {/* Queue Management Button */}
            {selectedDoctor && activeTab === "active" && (
              <Button
                onClick={() => setQueueManagementOpen(true)}
                variant="outline"
                size="sm"
                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              >
                <Activity className="h-4 w-4 mr-2" />
                Queue Management
              </Button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search patients, phone numbers, or appointment IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="min-w-[150px]"
                options={[
                  { value: "", label: "Select Doctor" },
                  ...doctors.map((doctor) => ({
                    value: doctor.id,
                    label: `Dr. ${doctor.name}`,
                  })),
                ]}
                required
              />

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {(selectedDoctor ||
                searchTerm ||
                selectedDate !== format(new Date(), "yyyy-MM-dd")) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDoctor("");
                    setSelectedDate(format(new Date(), "yyyy-MM-dd"));
                    setSearchTerm("");
                  }}
                >
                  Clear Filters
                </Button>
              )}

              <Button
                onClick={() => {
                  setRefreshing(true);
                  fetchQueue();
                }}
                disabled={refreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-100 mt-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">
                {currentAppointments.length}
              </span>{" "}
              {activeTab === "active" ? "in queue" : "completed"}
            </div>
            {activeTab === "active" && (
              <>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-blue-600">
                    {stats.scheduled}
                  </span>{" "}
                  scheduled
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-orange-600">
                    {stats.inProgress}
                  </span>{" "}
                  in progress
                </div>
              </>
            )}
            {activeTab === "completed" && (
              <div className="text-sm text-gray-600">
                <span className="font-medium text-green-600">
                  {stats.completed}
                </span>{" "}
                total completed today
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
      ) : currentAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === "active"
                ? "No active appointments"
                : "No completed appointments"}
            </h3>
            <p className="text-gray-500">
              {selectedDoctor || selectedDate
                ? `No ${activeTab} appointments found for the selected filters.`
                : `No ${activeTab} appointments yet.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentAppointments.map((appointment) => (
            <Card
              key={appointment.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Only show queue position for active appointments */}
                    {activeTab === "active" && (
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">
                            #{appointment.queue_position || 0}
                          </span>
                        </div>
                      </div>
                    )}

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
                          {appointment.status === AppointmentStatus.SCHEDULED &&
                          appointment.patient_checked_in
                            ? AppointmentStatus.CHECKED_IN
                            : appointment.status}
                        </span>
                        {appointment.emergency_status && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            🚨 EMERGENCY
                          </span>
                        )}
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
                          Patient #{appointment.patient?.id || "Unknown"}
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
                    {/* Only show action buttons for active appointments */}
                    {activeTab === "active" && getActionButton(appointment)}
                  </div>
                </div>

                {appointment.emergency_status &&
                  appointment.emergency_reason && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-sm text-red-700">
                        <span className="font-medium">
                          🚨 Emergency Reason:
                        </span>{" "}
                        {appointment.emergency_reason}
                      </p>
                    </div>
                  )}

                {appointment.symptoms && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Symptoms:</span>{" "}
                      {appointment.symptoms}
                    </p>
                  </div>
                )}

                {appointment.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Notes:</span>{" "}
                      {appointment.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Queue Management Modal */}
      <QueueManagementModal
        isOpen={queueManagementOpen}
        onClose={() => setQueueManagementOpen(false)}
        selectedDoctor={selectedDoctor}
        selectedDate={selectedDate}
        doctors={doctors}
        onRefreshQueue={fetchQueue}
      />
    </div>
  );
}
