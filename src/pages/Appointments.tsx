import { useState, useEffect } from "react";
import { AppointmentStatus } from "../constants";
import {
  Calendar,
  Clock,
  Search,
  Grid3X3,
  List,
  CalendarDays,
  MonitorSpeaker,
  User,
  Stethoscope,
  MapPin,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Edit3,
  Timer,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Card, CardContent } from "../components/ui/Card";
import { AddAppointmentModal } from "../components/appointmentComponents/AddAppointmentModal";
import { RescheduleAppointmentModal } from "../components/appointmentComponents/RescheduleAppointmentModal";
import { AppointmentDetailsModal } from "../components/appointmentComponents/AppointmentDetailsModal";
import { CalendarView } from "../components/CalendarView";
import { QueueTab } from "../components/queueComponents/QueueTab";
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
            /* Enhanced Appointments List */
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => {
                const statusColors = {
                  [AppointmentStatus.SCHEDULED]: {
                    badge: "bg-blue-100 text-blue-700 border-blue-200",
                    icon: Calendar,
                    iconColor: "text-blue-600",
                    border: "border-l-blue-500",
                  },
                  [AppointmentStatus.CHECKED_IN]: {
                    badge: "bg-green-100 text-green-700 border-green-200",
                    icon: CheckCircle,
                    iconColor: "text-green-600",
                    border: "border-l-green-500",
                  },
                  [AppointmentStatus.IN_PROGRESS]: {
                    badge: "bg-amber-100 text-amber-700 border-amber-200",
                    icon: Timer,
                    iconColor: "text-amber-600",
                    border: "border-l-amber-500",
                  },
                  [AppointmentStatus.COMPLETED]: {
                    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
                    icon: CheckCircle,
                    iconColor: "text-emerald-600",
                    border: "border-l-emerald-500",
                  },
                  [AppointmentStatus.CANCELLED]: {
                    badge: "bg-red-100 text-red-700 border-red-200",
                    icon: XCircle,
                    iconColor: "text-red-600",
                    border: "border-l-red-500",
                  },
                  [AppointmentStatus.NO_SHOW]: {
                    badge: "bg-gray-100 text-gray-700 border-gray-200",
                    icon: AlertTriangle,
                    iconColor: "text-gray-600",
                    border: "border-l-gray-500",
                  },
                };

                const statusConfig =
                  statusColors[
                    appointment.status as keyof typeof statusColors
                  ] || statusColors[AppointmentStatus.SCHEDULED];
                const StatusIcon = statusConfig.icon;
                const isToday =
                  new Date(appointment.appointment_datetime).toDateString() ===
                  new Date().toDateString();
                const isPast =
                  new Date(appointment.appointment_datetime) < new Date();

                return (
                  <div
                    key={appointment.id}
                    className="cursor-pointer"
                    onClick={() => openDetails(appointment)}
                  >
                    <Card
                      className={`hover:shadow-md transition-all duration-200 border-l-4 ${statusConfig.border} overflow-hidden`}
                    >
                      <CardContent className="p-6">
                        {/* Header Section */}
                        <div className="flex items-start justify-between mb-4">
                          {/* Patient & Doctor Info */}
                          <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                              <User className="w-7 h-7 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-xl font-bold text-gray-900">
                                  {appointment.patient?.name}
                                </h3>
                                {isToday && (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                    Today
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 mt-1">
                                <Stethoscope className="w-4 h-4 text-gray-500" />
                                <p className="text-gray-600 font-medium">
                                  Dr. {appointment.doctor?.name}
                                </p>
                              </div>
                              {appointment.patient?.contact && (
                                <div className="flex items-center space-x-1 mt-1">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <p className="text-gray-500 text-sm">
                                    {appointment.patient.contact}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Status & Actions */}
                          <div className="flex items-center space-x-3">
                            <div
                              className={`px-3 py-2 rounded-lg border font-medium text-sm flex items-center space-x-2 ${statusConfig.badge}`}
                            >
                              <StatusIcon
                                className={`w-4 h-4 ${statusConfig.iconColor}`}
                              />
                              <span>
                                {appointment.status
                                  .replace("_", " ")
                                  .toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetails(appointment);
                                }}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                              {!isPast && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRescheduleAppointment(appointment);
                                  }}
                                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Reschedule"
                                >
                                  <Edit3 className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Appointment Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          {/* Date & Time */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <Calendar className="w-5 h-5 text-gray-600" />
                              <span className="font-medium text-gray-700">
                                Date & Time
                              </span>
                            </div>
                            <p className="text-gray-900 font-semibold text-sm">
                              {format(
                                new Date(appointment.appointment_datetime),
                                "EEEE, MMM d, yyyy"
                              )}
                            </p>
                            <div className="flex items-center space-x-1 mt-1">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <p className="text-gray-600 text-sm">
                                {format(
                                  new Date(appointment.appointment_datetime),
                                  "h:mm a"
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Location */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <MapPin className="w-5 h-5 text-gray-600" />
                              <span className="font-medium text-gray-700">
                                Location
                              </span>
                            </div>
                            <p className="text-gray-900 text-sm">
                              {appointment.doctor?.specialization ||
                                "General Consultation"}
                            </p>
                            <p className="text-gray-600 text-sm">
                              Room {Math.floor(Math.random() * 10) + 1}
                            </p>
                          </div>

                          {/* Type */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <Stethoscope className="w-5 h-5 text-gray-600" />
                              <span className="font-medium text-gray-700">
                                Type
                              </span>
                            </div>
                            <p className="text-gray-900 text-sm">
                              {appointment.appointment_type ||
                                "General Checkup"}
                            </p>
                            <p className="text-gray-600 text-sm">
                              {appointment.duration_minutes} minutes
                            </p>
                          </div>
                        </div>

                        {/* Delay Information */}
                        {Number(appointment.delay_minutes ?? 0) > 0 && (
                          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg mb-4">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="w-5 h-5 text-amber-600" />
                              <span className="font-medium text-amber-800 text-sm">
                                Delayed by{" "}
                                {Number(appointment.delay_minutes ?? 0)} minute
                                {Number(appointment.delay_minutes ?? 0) === 1
                                  ? ""
                                  : "s"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {appointment.notes && (
                          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <MonitorSpeaker className="w-5 h-5 text-blue-600 mt-0.5" />
                              <div>
                                <span className="font-medium text-blue-800 text-sm block">
                                  Notes:
                                </span>
                                <p className="text-blue-700 text-sm mt-1">
                                  {appointment.notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
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
