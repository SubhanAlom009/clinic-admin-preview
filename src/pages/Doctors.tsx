import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Phone, UserCheck } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardContent } from "../components/ui/Card";
import { AddDoctorModal } from "../components/doctorComponents/AddDoctorModal";
import { EditDoctorModal } from "../components/doctorComponents/EditDoctorModal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Doctor } from "../types";
import { format } from "date-fns";

export function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchDoctors = async () => {
      const { data } = await supabase
        .from("doctors")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setDoctors(data);
        setFilteredDoctors(data);
      }
      setLoading(false);
    };

    fetchDoctors();

    // Real-time subscription
    const subscription = supabase
      .channel("doctors")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doctors",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchDoctors();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const filtered = doctors.filter(
      (doctor) =>
        doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.specialization
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        doctor.contact.includes(searchTerm)
    );
    setFilteredDoctors(filtered);
  }, [searchTerm, doctors]);

  const deleteDoctor = async (id: string) => {
    if (!confirm("Are you sure you want to delete this doctor?")) return;

    const { error } = await supabase.from("doctors").delete().eq("id", id);

    if (error) {
      alert("Error deleting doctor: " + error.message);
    }
  };

  const handleEditDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsEditModalOpen(true);
  };

  const handleCloseModals = () => {
    setSelectedDoctor(null);
    setIsEditModalOpen(false);
  };

  // custom skeleton )
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-64"></div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-36">
                <div className="h-10 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </div>
          <div>
            <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <th key={i} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, row) => (
                  <tr key={row} className="border-b">
                    <td className="px-4 py-4 align-top text-sm text-gray-600">
                      <div className="h-4 bg-gray-200 rounded w-4"></div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-28 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-blue-600">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-900">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-700">
                      <div className="h-4 bg-gray-200 rounded w-40"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-700">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-green-600">
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-500">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-right space-x-1">
                      <div className="inline-block h-4 w-4 rounded bg-gray-200 ml-auto"></div>
                      <div className="inline-block h-4 w-4 rounded bg-gray-200 ml-2"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-600 mt-1">Manage your medical staff</p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="mt-4 sm:mt-0"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Doctor
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search doctors by name, specialization, or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Doctors Table */}
      <Card>
        <CardContent className="p-4">
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Specialization
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Experience
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fee
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDoctors.map((doctor, index) => (
                  <tr key={doctor.id}>
                    <td className="px-4 py-3 align-top text-sm text-gray-600">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-medium text-gray-900">
                        {doctor.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {doctor.qualifications ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-blue-600">
                      {doctor.specialization}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{doctor.contact}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">
                      {doctor.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">
                      {doctor.experience_years
                        ? `${doctor.experience_years} yrs`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-green-600">
                      {doctor.consultation_fee > 0
                        ? `₹${doctor.consultation_fee}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-500">
                      {format(new Date(doctor.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 align-top text-right space-x-1">
                      <button
                        onClick={() => handleEditDoctor(doctor)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-150"
                        title="Edit Doctor"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteDoctor(doctor.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150"
                        title="Delete Doctor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredDoctors.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <UserCheck className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No doctors found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "Get started by adding your first doctor"}
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Add Doctor
            </Button>
          </CardContent>
        </Card>
      )}

      <AddDoctorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <EditDoctorModal
        isOpen={isEditModalOpen}
        onClose={handleCloseModals}
        doctor={selectedDoctor}
      />
    </div>
  );
}
