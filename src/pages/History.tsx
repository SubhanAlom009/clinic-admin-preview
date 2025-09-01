import React, { useState, useEffect } from "react";
import {
  History as HistoryIcon,
  User,
  Calendar,
  Receipt,
  Activity,
  Search,
  Filter,
  Eye,
  FileText,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Appointment, Bill, Patient, Doctor } from "../types";
import { format } from "date-fns";

interface HistoryRecord {
  id: string;
  type: "appointment" | "payment" | "treatment" | "system";
  title: string;
  description: string;
  date: string;
  patient?: Patient;
  doctor?: Doctor;
  amount?: number;
  status?: string;
  details?: any;
}

export function History() {
  const [activeTab, setActiveTab] = useState("all");
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<HistoryRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchHistoryData = async () => {
      try {
        // Fetch appointments with patient and doctor info
        const { data: appointments } = await supabase
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

        // Fetch bills with patient info
        const { data: bills } = await supabase
          .from("bills")
          .select(
            `
            *,
            patient:patients(*)
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        // Fetch followups with patient info
        const { data: followups } = await supabase
          .from("followups")
          .select(
            `
            *,
            patient:patients(*),
            appointment:appointments(*)
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        // Transform data into unified history records
        const records: HistoryRecord[] = [];

        // Add appointment records
        appointments?.forEach((appointment) => {
          records.push({
            id: appointment.id,
            type: "appointment",
            title: `Appointment with ${appointment.patient?.name}`,
            description: `${appointment.doctor?.name} - ${appointment.doctor?.specialization}`,
            date: appointment.appointment_datetime,
            patient: appointment.patient,
            doctor: appointment.doctor,
            status: appointment.status,
            details: {
              symptoms: appointment.symptoms,
              diagnosis: appointment.diagnosis,
              prescription: appointment.prescription,
              notes: appointment.notes,
              duration: appointment.duration_minutes,
            },
          });
        });

        // Add billing records
        bills?.forEach((bill) => {
          records.push({
            id: bill.id,
            type: "payment",
            title: `Bill ${bill.bill_number}`,
            description: `Payment for ${bill.patient?.name}`,
            date: bill.created_at,
            patient: bill.patient,
            amount: bill.total_amount,
            status: bill.status,
            details: {
              billNumber: bill.bill_number,
              amount: bill.amount,
              taxAmount: bill.tax_amount,
              paymentMode: bill.payment_mode,
              paymentDate: bill.payment_date,
              dueDate: bill.due_date,
              notes: bill.notes,
            },
          });
        });

        // Add followup records
        followups?.forEach((followup) => {
          records.push({
            id: followup.id,
            type: "treatment",
            title: `Follow-up for ${followup.patient?.name}`,
            description: `Follow-up appointment scheduled`,
            date: followup.created_at,
            patient: followup.patient,
            status: followup.status,
            details: {
              dueDate: followup.due_date,
              notes: followup.notes,
              appointmentId: followup.appointment_id,
            },
          });
        });

        // Sort all records by date (newest first)
        records.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setHistoryRecords(records);
        setFilteredRecords(records);
      } catch (error) {
        console.error("Error fetching history data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, [user]);

  useEffect(() => {
    let filtered = historyRecords;

    // Filter by active tab
    if (activeTab !== "all") {
      filtered = filtered.filter((record) => record.type === activeTab);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (record) =>
          record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.patient?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (typeFilter) {
      filtered = filtered.filter((record) => record.type === typeFilter);
    }

    setFilteredRecords(filtered);
  }, [activeTab, searchTerm, typeFilter, historyRecords]);

  const getRecordIcon = (type: string) => {
    switch (type) {
      case "appointment":
        return Calendar;
      case "payment":
        return Receipt;
      case "treatment":
        return FileText;
      case "system":
        return Activity;
      default:
        return HistoryIcon;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return "bg-green-100 text-green-800";
      case "scheduled":
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "no_show":
        return "bg-gray-100 text-gray-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const tabs = [
    { id: "all", label: "All Records", icon: HistoryIcon },
    { id: "appointment", label: "Appointments", icon: Calendar },
    { id: "payment", label: "Payments", icon: Receipt },
    { id: "treatment", label: "Treatments", icon: FileText },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="flex space-x-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded w-24"></div>
            ))}
          </div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">History & Records</h1>
        <p className="text-gray-600 mt-1">
          Complete timeline of clinic activities and patient records
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by patient name, description, or details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              label=""
              name="typeFilter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: "", label: "All Types" },
                { value: "appointment", label: "Appointments" },
                { value: "payment", label: "Payments" },
                { value: "treatment", label: "Treatments" },
                { value: "system", label: "System" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* History Timeline */}
      <div className="space-y-4">
        {filteredRecords.map((record, index) => {
          const Icon = getRecordIcon(record.type);
          return (
            <Card
              key={record.id}
              className="hover:shadow-md transition-shadow duration-200"
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`p-2 rounded-full ${
                        record.type === "appointment"
                          ? "bg-blue-100"
                          : record.type === "payment"
                          ? "bg-green-100"
                          : record.type === "treatment"
                          ? "bg-purple-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          record.type === "appointment"
                            ? "text-blue-600"
                            : record.type === "payment"
                            ? "text-green-600"
                            : record.type === "treatment"
                            ? "text-purple-600"
                            : "text-gray-600"
                        }`}
                      />
                    </div>
                    {index < filteredRecords.length - 1 && (
                      <div className="w-px h-16 bg-gray-200 mt-2"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {record.title}
                          </h3>
                          {record.status && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                record.status
                              )}`}
                            >
                              {record.status.replace("_", " ").toUpperCase()}
                            </span>
                          )}
                        </div>

                        <p className="text-gray-600 mb-2">
                          {record.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {format(
                              new Date(record.date),
                              "MMM d, yyyy h:mm a"
                            )}
                          </div>
                          {record.patient && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {record.patient.name}
                            </div>
                          )}
                          {record.amount && (
                            <div className="flex items-center">
                              <Receipt className="h-4 w-4 mr-1" />₹
                              {record.amount.toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Detailed Information */}
                        {record.details && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            {record.type === "appointment" && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {record.details.symptoms && (
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Symptoms:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {record.details.symptoms}
                                    </p>
                                  </div>
                                )}
                                {record.details.diagnosis && (
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Diagnosis:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {record.details.diagnosis}
                                    </p>
                                  </div>
                                )}
                                {record.details.prescription && (
                                  <div className="md:col-span-2">
                                    <span className="font-medium text-gray-700">
                                      Prescription:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {record.details.prescription}
                                    </p>
                                  </div>
                                )}
                                {record.details.notes && (
                                  <div className="md:col-span-2">
                                    <span className="font-medium text-gray-700">
                                      Notes:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {record.details.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {record.type === "payment" && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700">
                                    Bill Number:
                                  </span>
                                  <p className="text-gray-600 mt-1">
                                    {record.details.billNumber}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">
                                    Amount:
                                  </span>
                                  <p className="text-gray-600 mt-1">
                                    ₹{record.details.amount}
                                  </p>
                                </div>
                                {record.details.taxAmount > 0 && (
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Tax:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      ₹{record.details.taxAmount}
                                    </p>
                                  </div>
                                )}
                                {record.details.paymentMode && (
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Payment Mode:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {record.details.paymentMode.toUpperCase()}
                                    </p>
                                  </div>
                                )}
                                {record.details.paymentDate && (
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Payment Date:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {format(
                                        new Date(record.details.paymentDate),
                                        "MMM d, yyyy"
                                      )}
                                    </p>
                                  </div>
                                )}
                                {record.details.notes && (
                                  <div className="md:col-span-3">
                                    <span className="font-medium text-gray-700">
                                      Notes:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {record.details.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {record.type === "treatment" && (
                              <div className="text-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <span className="font-medium text-gray-700">
                                      Due Date:
                                    </span>
                                    <p className="text-gray-600 mt-1">
                                      {format(
                                        new Date(record.details.dueDate),
                                        "MMM d, yyyy"
                                      )}
                                    </p>
                                  </div>
                                  {record.details.notes && (
                                    <div>
                                      <span className="font-medium text-gray-700">
                                        Notes:
                                      </span>
                                      <p className="text-gray-600 mt-1">
                                        {record.details.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-2 mt-4 lg:mt-0">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredRecords.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <HistoryIcon className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No history records found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || typeFilter || activeTab !== "all"
                ? "Try adjusting your search criteria or filters"
                : "History will appear here as you use the system"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
