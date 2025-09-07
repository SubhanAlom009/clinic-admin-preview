import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Users,
  AlertTriangle,
  Pill,
  Heart,
  FileText,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardContent } from "../components/ui/Card";
import { AddPatientModal } from "../components/AddPatientModal";
import { ViewPatientModal } from "../components/ViewPatientModal";
import { EditPatientModal } from "../components/EditPatientModal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Patient } from "../types";
import { format } from "date-fns";

export function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchPatients = async () => {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setPatients(data);
        setFilteredPatients(data);
      }
      setLoading(false);
    };

    fetchPatients();

    // Real-time subscription
    const subscription = supabase
      .channel("patients")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patients",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchPatients();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const filtered = patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.contact.includes(searchTerm) ||
        (patient.email &&
          patient.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredPatients(filtered);
  }, [searchTerm, patients]);

  const deletePatient = async (id: string) => {
    if (!confirm("Are you sure you want to delete this patient?")) return;

    const { error } = await supabase.from("patients").delete().eq("id", id);

    if (error) {
      alert("Error deleting patient: " + error.message);
    }
  };

  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsViewModalOpen(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsEditModalOpen(true);
  };

  const handleCloseModals = () => {
    setSelectedPatient(null);
    setIsViewModalOpen(false);
    setIsEditModalOpen(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
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
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-600 mt-1">Manage your patient records</p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="mt-4 sm:mt-0"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Patient
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search patients by name, contact, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map((patient) => {
          // Helper function to check if patient has medical history
          const hasMedicalHistory = (patient: Patient) => {
            return !!(
              patient.allergies?.length ||
              patient.chronic_conditions?.length ||
              patient.medications?.length ||
              patient.previous_surgeries?.length ||
              patient.family_history ||
              patient.additional_notes ||
              (patient.medical_history &&
                Object.keys(patient.medical_history).length > 0)
            );
          };

          const medicalHistoryCount = [
            patient.allergies?.length && "allergies",
            patient.chronic_conditions?.length && "conditions",
            patient.medications?.length && "medications",
            patient.previous_surgeries?.length && "surgeries",
            patient.family_history && "family history",
            patient.additional_notes && "notes",
          ].filter(Boolean).length;

          return (
            <Card
              key={patient.id}
              className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {patient.name}
                      </h3>
                      {hasMedicalHistory(patient) && (
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4 text-red-500" />
                          <span className="text-xs text-gray-500 bg-red-50 px-2 py-1 rounded-full">
                            {medicalHistoryCount} records
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {patient.age && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {patient.age} years
                        </span>
                      )}
                      {patient.gender && (
                        <span className="text-gray-400">•</span>
                      )}
                      {patient.gender && <span>{patient.gender}</span>}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleViewPatient(patient)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="View Patient Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditPatient(patient)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                      title="Edit Patient"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deletePatient(patient.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Delete Patient"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-900 font-medium">
                      {patient.contact}
                    </span>
                  </div>
                  {patient.email && (
                    <div className="flex items-center text-sm">
                      <Mail className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-900">{patient.email}</span>
                    </div>
                  )}

                  {/* Medical Indicators */}
                  {hasMedicalHistory(patient) && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex flex-wrap gap-1">
                        {patient.allergies?.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                            <AlertTriangle className="h-3 w-3" />
                            Allergies
                          </span>
                        )}
                        {patient.chronic_conditions?.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                            <Heart className="h-3 w-3" />
                            Conditions
                          </span>
                        )}
                        {patient.medications?.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                            <Pill className="h-3 w-3" />
                            Medications
                          </span>
                        )}
                        {patient.previous_surgeries?.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                            <FileText className="h-3 w-3" />
                            Surgery History
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <span>
                      Registered:{" "}
                      {format(new Date(patient.created_at), "MMM d, yyyy")}
                    </span>
                    {patient.emergency_contact && (
                      <span className="text-green-600">
                        Emergency contact available
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredPatients.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <Users className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No patients found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "Get started by adding your first patient"}
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Add Patient
            </Button>
          </CardContent>
        </Card>
      )}

      <AddPatientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <ViewPatientModal
        isOpen={isViewModalOpen}
        onClose={handleCloseModals}
        patient={selectedPatient}
      />

      <EditPatientModal
        isOpen={isEditModalOpen}
        onClose={handleCloseModals}
        patient={selectedPatient}
      />
    </div>
  );
}
