import React, { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Patient, Doctor } from "../types";
import { format } from "date-fns";

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddAppointmentModal({
  isOpen,
  onClose,
}: AddAppointmentModalProps) {
  const [formData, setFormData] = useState({
    patient_id: "",
    doctor_id: "",
    appointment_datetime: "",
    duration_minutes: "30",
    notes: "",
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  // Get current date and time in the required format for datetime-local input
  const getCurrentDateTime = () => {
    const now = new Date();
    // Add 1 hour to current time as minimum appointment time
    now.setHours(now.getHours() + 1);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  };

  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchData = async () => {
      const [patientsResult, doctorsResult] = await Promise.all([
        supabase
          .from("patients")
          .select("*")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("doctors")
          .select("*")
          .eq("user_id", user.id)
          .order("name"),
      ]);

      if (patientsResult.data) setPatients(patientsResult.data);
      if (doctorsResult.data) setDoctors(doctorsResult.data);
    };

    fetchData();
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.from("appointments").insert({
        user_id: user.id,
        patient_id: formData.patient_id,
        doctor_id: formData.doctor_id,
        appointment_datetime: formData.appointment_datetime,
        duration_minutes: parseInt(formData.duration_minutes),
        notes: formData.notes || null,
      });

      if (error) throw error;

      // Create notification
      const patient = patients.find((p) => p.id === formData.patient_id);
      const doctor = doctors.find((d) => d.id === formData.doctor_id);

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "appointment",
        title: "Appointment Scheduled",
        message: `Appointment scheduled for ${patient?.name} with ${doctor?.name}`,
        priority: "normal",
      });

      onClose();
      setFormData({
        patient_id: "",
        doctor_id: "",
        appointment_datetime: "",
        duration_minutes: "30",
        notes: "",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule New Appointment"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Patient"
            name="patient_id"
            value={formData.patient_id}
            onChange={handleInputChange}
            required
            options={patients.map((patient) => ({
              value: patient.id,
              label: `${patient.name} - ${patient.contact}`,
            }))}
          />
          <Select
            label="Doctor"
            name="doctor_id"
            value={formData.doctor_id}
            onChange={handleInputChange}
            required
            options={doctors.map((doctor) => ({
              value: doctor.id,
              label: `${doctor.name} - ${doctor.specialization}`,
            }))}
          />
          <Input
            label="Date & Time"
            name="appointment_datetime"
            type="datetime-local"
            value={formData.appointment_datetime}
            onChange={handleInputChange}
            min={getCurrentDateTime()}
            required
          />
          <Select
            label="Duration"
            name="duration_minutes"
            value={formData.duration_minutes}
            onChange={handleInputChange}
            options={[
              { value: "15", label: "15 minutes" },
              { value: "30", label: "30 minutes" },
              { value: "45", label: "45 minutes" },
              { value: "60", label: "1 hour" },
              { value: "90", label: "1.5 hours" },
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add any notes for the appointment"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Scheduling..." : "Schedule Appointment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
