import React, { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Eye, Users } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "../components/ui/Card";
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
        {filteredPatients.map((patient) => (
          <Card
            key={patient.id}
            className="hover:shadow-md transition-shadow duration-200"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {patient.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {patient.age && `${patient.age} years`}{" "}
                    {patient.gender && `• ${patient.gender}`}
                  </p>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleViewPatient(patient)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors duration-200"
                    title="View Patient Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditPatient(patient)}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors duration-200"
                    title="Edit Patient"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deletePatient(patient.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                    title="Delete Patient"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-20">Phone:</span>
                  <span className="text-gray-900">{patient.contact}</span>
                </div>
                {patient.email && (
                  <div className="flex items-center text-sm">
                    <span className="text-gray-500 w-20">Email:</span>
                    <span className="text-gray-900">{patient.email}</span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-20">Joined:</span>
                  <span className="text-gray-900">
                    {format(new Date(patient.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
