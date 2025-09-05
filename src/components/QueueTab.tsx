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
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Card, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { MetricCard } from "./ui/MetricCard";
import { AppointmentService } from "../services/AppointmentService";
import { AppointmentStatus } from "../constants";
import { useAuth } from "../hooks/useAuth";
import { Appointment, Doctor } from "../types";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";

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

      // Use AppointmentService instead of direct Supabase calls
      const response = await AppointmentService.getAppointments({
        doctorId: selectedDoctor || undefined,
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

      const { error } = await (supabase as any)
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

  const checkInPatient = (appointment: Appointment) => {
    updateAppointmentStatus(appointment.id, AppointmentStatus.CHECKED_IN, {
      patient_checked_in: true,
      checked_in_at: new Date().toISOString(),
    });
  };

  const startAppointment = (appointment: Appointment) => {
    updateAppointmentStatus(appointment.id, AppointmentStatus.IN_PROGRESS, {
      actual_start_time: new Date().toISOString(),
    });
  };

  const completeAppointment = (appointment: Appointment) => {
    updateAppointmentStatus(appointment.id, AppointmentStatus.COMPLETED, {
      actual_end_time: new Date().toISOString(),
    });
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

  const queueStats = {
    total: queueData.length,
    checkedIn: queueData.filter(
      (a) => a.patient_checked_in || a.status === AppointmentStatus.CHECKED_IN
    ).length,
    inProgress: queueData.filter(
      (a) => a.status === AppointmentStatus.IN_PROGRESS
    ).length,
    completed: queueData.filter((a) => a.status === AppointmentStatus.COMPLETED)
      .length,
  };

  const stats = {
    scheduled: filteredQueue.filter(
      (a) => a.status === AppointmentStatus.SCHEDULED
    ).length,
    inProgress: filteredQueue.filter(
      (a) => a.status === AppointmentStatus.IN_PROGRESS
    ).length,
    completed: filteredQueue.filter(
      (a) => a.status === AppointmentStatus.COMPLETED
    ).length,
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

      {/* Queue Controls */}
      <Card>
        <CardContent className="py-4">
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
                  { value: "", label: "All Doctors" },
                  ...doctors.map((doctor) => ({
                    value: doctor.id,
                    label: `Dr. ${doctor.name}`,
                  })),
                ]}
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

              <div className="flex items-center space-x-2">
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
                    className={`h-4 w-4 mr-2 ${
                      refreshing ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-100 mt-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">
                {filteredQueue.length}
              </span>{" "}
              appointments
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-green-600">
                {stats.completed}
              </span>{" "}
              completed
            </div>
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
      ) : queueData.length === 0 ? (
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
          {queueData.map((appointment, index) => (
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
                          {appointment.status === AppointmentStatus.SCHEDULED &&
                          appointment.patient_checked_in
                            ? AppointmentStatus.CHECKED_IN
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
    </div>
  );
}
