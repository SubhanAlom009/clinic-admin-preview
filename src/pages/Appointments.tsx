import { useState, useEffect } from "react";
import { AppointmentStatus } from "../constants";
import {
  Calendar,
  Clock,
  UserCheck,
  Search,
  Grid3X3,
  List,
  CalendarDays,
  MonitorSpeaker,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Card, CardContent } from "../components/ui/Card";
import { AddAppointmentModal } from "../components/AddAppointmentModal";
import { RescheduleAppointmentModal } from "../components/RescheduleAppointmentModal";
import { AppointmentDetailsModal } from "../components/AppointmentDetailsModal";
import { CalendarView } from "../components/CalendarView";
import { QueueTab } from "../components/QueueTab";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Appointment } from "../types";
import { format } from "date-fns";

export function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<
    Appointment[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [activeTab, setActiveTab] = useState<"appointments" | "queue">(
    "appointments"
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchAppointments = async () => {
      const { data } = await supabase
        .from("appointments")
        .select(
          `
          *,
          patient:patients(*),
          doctor:doctors(*)
        `
        )
        .eq("user_id", user.id)
        .order("appointment_datetime", { ascending: false });

      if (data) {
        setAppointments(data);
        setFilteredAppointments(data);
      }
      setLoading(false);
    };

    fetchAppointments();

    // Real-time subscription
    const subscription = supabase
      .channel("appointments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    let filtered = appointments;

    if (searchTerm) {
      filtered = filtered.filter(
        (appointment) =>
          appointment.patient?.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          appointment.doctor?.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(
        (appointment) => appointment.status === statusFilter
      );
    }

    setFilteredAppointments(filtered);
  }, [searchTerm, statusFilter, appointments]);

  // local optimistic update helper after modal actions
  const applyLocalPatch = (patch: Partial<Appointment> & { id: string }) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === patch.id ? { ...a, ...patch } : a))
    );
    setFilteredAppointments((prev) =>
      prev.map((a) => (a.id === patch.id ? { ...a, ...patch } : a))
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case AppointmentStatus.SCHEDULED:
        return "bg-blue-100 text-blue-800";
      case AppointmentStatus.COMPLETED:
        return "bg-green-100 text-green-800";
      case AppointmentStatus.CANCELLED:
        return "bg-red-100 text-red-800";
      case AppointmentStatus.NO_SHOW:
        return "bg-gray-100 text-gray-800";
      case AppointmentStatus.RESCHEDULED:
        return "bg-yellow-100 text-yellow-800";
      case AppointmentStatus.CHECKED_IN:
        return "bg-green-100 text-green-800";
      case AppointmentStatus.IN_PROGRESS:
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const openDetails = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  const handleRescheduleAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(false);
    setIsRescheduleModalOpen(true);
  };

  const handleCloseModals = () => {
    setSelectedAppointment(null);
    setIsRescheduleModalOpen(false);
    setShowDetailsModal(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Appointments & Queue
          </h1>
          <p className="text-gray-600 mt-1">
            Manage appointments and monitor live queue
          </p>
        </div>
        {activeTab === "appointments" && (
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 sm:mt-0"
          >
            <Calendar className="h-5 w-5 mr-2" />
            Schedule Appointment
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <Card>
        <CardContent className="py-0">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("appointments")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "appointments"
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center space-x-2">
                <CalendarDays className="h-4 w-4" />
                <span>Appointment Management</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "queue"
                  ? "border-blue-500 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center space-x-2">
                <MonitorSpeaker className="h-4 w-4" />
                <span>Live Queue Dashboard</span>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === "appointments" ? (
        <div className="space-y-6">
          {/* Search and Filter for Appointments */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Search by patient or doctor name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  label=""
                  name="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: "", label: "All Statuses" },
                    { value: AppointmentStatus.SCHEDULED, label: "Scheduled" },
                    { value: AppointmentStatus.COMPLETED, label: "Completed" },
                    { value: AppointmentStatus.CANCELLED, label: "Cancelled" },
                    { value: AppointmentStatus.NO_SHOW, label: "No Show" },
                    {
                      value: AppointmentStatus.RESCHEDULED,
                      label: "Rescheduled",
                    },
                    {
                      value: AppointmentStatus.CHECKED_IN,
                      label: "Checked-In",
                    },
                    {
                      value: AppointmentStatus.IN_PROGRESS,
                      label: "In-Progress",
                    },
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          {/* View Toggle */}
          <div className="flex justify-end">
            <div className="flex rounded-lg border border-gray-200 bg-white p-1">
              <Button
                variant={viewMode === "list" ? "primary" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center space-x-2"
              >
                <List className="h-4 w-4" />
                <span>List</span>
              </Button>
              <Button
                variant={viewMode === "calendar" ? "primary" : "outline"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="flex items-center space-x-2"
              >
                <Grid3X3 className="h-4 w-4" />
                <span>Calendar</span>
              </Button>
            </div>
          </div>

          {/* Content based on view mode */}
          {viewMode === "calendar" ? (
            <CalendarView onSelectAppointment={openDetails} />
          ) : (
            /* Appointments List */
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
                <Card
                  key={appointment.id}
                  className="hover:shadow-md transition-shadow duration-200 cursor-pointer"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {appointment.patient?.name}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              appointment.status
                            )}`}
                          >
                            {appointment.status.replace("_", " ").toUpperCase()}
                          </span>
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-4 text-sm text-gray-600"
                          onClick={() => openDetails(appointment)}
                        >
                          <div className="flex items-center">
                            <UserCheck className="h-4 w-4 mr-1" />
                            {appointment.doctor?.name}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {format(
                              new Date(appointment.appointment_datetime),
                              "MMM d, yyyy"
                            )}
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {format(
                              new Date(appointment.appointment_datetime),
                              "h:mm a"
                            )}
                          </div>
                        </div>

                        {appointment.notes && (
                          <p className="text-sm text-gray-600 mt-2">
                            {appointment.notes}
                          </p>
                        )}
                      </div>

                      {/* Inline action buttons removed; open modal instead */}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filteredAppointments.length === 0 && !loading && (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-gray-400 mb-4">
                  <Calendar className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No appointments found
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm || statusFilter
                    ? "Try adjusting your search criteria"
                    : "Get started by scheduling your first appointment"}
                </p>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Calendar className="h-5 w-5 mr-2" />
                  Schedule Appointment
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        // Queue Dashboard Tab Content
        <QueueTab />
      )}

      {/* Modals */}
      <AddAppointmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <RescheduleAppointmentModal
        isOpen={isRescheduleModalOpen}
        onClose={handleCloseModals}
        appointment={selectedAppointment}
      />

      <AppointmentDetailsModal
        isOpen={showDetailsModal}
        appointment={selectedAppointment}
        onClose={() => setShowDetailsModal(false)}
        onReschedule={handleRescheduleAppointment}
        onAfterUpdate={applyLocalPatch}
      />
    </div>
  );
}
