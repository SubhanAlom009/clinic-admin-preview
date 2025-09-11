/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { X, Calendar } from "lucide-react";
import { Button } from "../ui/button";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { AppointmentStatus } from "../../constants";
import { Patient, Doctor } from "../../types";

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
    appointment_type: "Consultation",
    notes: "",
    symptoms: "", // Add symptoms field
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchData = async () => {
      console.log("Fetching patients and doctors for user:", user.id);

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

      if (patientsResult.error) {
        console.error("Error fetching patients:", patientsResult.error);
      } else {
        console.log("Patients fetched:", patientsResult.data?.length);
        setPatients(patientsResult.data || []);
      }

      if (doctorsResult.error) {
        console.error("Error fetching doctors:", doctorsResult.error);
      } else {
        console.log("Doctors fetched:", doctorsResult.data?.length);
        setDoctors(doctorsResult.data || []);
      }
    };

    fetchData();
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // FIXED: Validate UUID fields before submission
    if (!formData.patient_id || formData.patient_id === "") {
      setError("Please select a patient");
      return;
    }

    if (!formData.doctor_id || formData.doctor_id === "") {
      setError("Please select a doctor");
      return;
    }

    if (!formData.appointment_datetime) {
      setError("Please select appointment date and time");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const appointmentData = {
        user_id: user.id,
        patient_id: formData.patient_id, // This must be a valid UUID
        doctor_id: formData.doctor_id, // This must be a valid UUID
        appointment_datetime: new Date(
          formData.appointment_datetime
        ).toISOString(),
        duration_minutes: parseInt(formData.duration_minutes),
        appointment_type: formData.appointment_type,
        notes: formData.notes || null,
        symptoms: formData.symptoms || null, // Add symptoms to appointment data
        status: AppointmentStatus.SCHEDULED,
      };

      console.log("Creating appointment with data:", appointmentData);
      console.log("Status value:", appointmentData.status);
      console.log("Status enum value:", AppointmentStatus.SCHEDULED);
      console.log(
        "Are they equal?",
        appointmentData.status === AppointmentStatus.SCHEDULED
      );

      const { data, error: insertError } = await (supabase as any)
        .from("appointments")
        .insert(appointmentData)
        .select()
        .single();

      if (insertError) {
        console.error("Appointment creation error:", insertError);
        throw insertError;
      }

      console.log("Appointment created successfully:", data);

      // Trigger queue recalculation for the doctor/day
      const appointmentDate = new Date(formData.appointment_datetime);
      const serviceDay = appointmentDate.toISOString().split("T")[0]; // Get YYYY-MM-DD format

      try {
        const { error: queueError } = await (supabase as any)
          .from("job_queue")
          .insert({
            job_type: "RECALCULATE_QUEUE",
            payload: {
              doctor_id: formData.doctor_id,
              service_day: serviceDay,
              trigger: "appointment_creation",
            },
            priority: 1,
            scheduled_for: new Date().toISOString(),
          });

        if (queueError) {
          console.warn("Queue recalculation job creation failed:", queueError);
          // Don't fail the whole appointment creation for this
        } else {
          console.log("Queue recalculation job scheduled");
        }
      } catch (queueErr) {
        console.warn("Queue recalculation error:", queueErr);
      }

      // Create notification
      const patient = patients.find((p) => p.id === formData.patient_id);
      const doctor = doctors.find((d) => d.id === formData.doctor_id);

      await (supabase as any).from("notifications").insert({
        user_id: user.id,
        type: "appointment",
        title: "New Appointment Scheduled",
        message: `Appointment scheduled for ${patient?.name} with ${doctor?.name}`,
        priority: "normal",
      });

      onClose();
      setFormData({
        patient_id: "",
        doctor_id: "",
        appointment_datetime: "",
        duration_minutes: "30",
        appointment_type: "Consultation",
        notes: "",
        symptoms: "", // Include symptoms in reset
      });
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      setError(err.message || "Failed to create appointment");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    console.log(`Form field changed: ${name} = ${value}`); // Debug log
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Generate minimum datetime (current time)
  const now = new Date();
  const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold flex items-center">
            <Calendar className="h-6 w-6 mr-2 text-blue-600" />
            Schedule New Appointment
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient *
              </label>
              <select
                name="patient_id"
                value={formData.patient_id}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} - {patient.contact}
                  </option>
                ))}
              </select>
              {patients.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No patients found. Add patients first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Doctor *
              </label>
              <select
                name="doctor_id"
                value={formData.doctor_id}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} - {doctor.specialization}
                  </option>
                ))}
              </select>
              {doctors.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No doctors found. Add doctors first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                name="appointment_datetime"
                value={formData.appointment_datetime}
                onChange={handleInputChange}
                min={minDateTime}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                required
                style={{
                  colorScheme: "light",
                  WebkitAppearance: "none",
                  MozAppearance: "textfield",
                }}
                onClick={(e) => {
                  // Force focus and show picker
                  e.currentTarget.focus();
                  e.currentTarget.showPicker?.();
                }}
                onFocus={(e) => {
                  // Show picker on focus
                  e.currentTarget.showPicker?.();
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Click to select date and time
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <select
                name="duration_minutes"
                value={formData.duration_minutes}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appointment Type
              </label>
              <select
                name="appointment_type"
                value={formData.appointment_type}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Consultation">Consultation</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Emergency">Emergency</option>
                <option value="Routine Checkup">Routine Checkup</option>
                <option value="Specialist Consultation">
                  Specialist Consultation
                </option>
                <option value="Procedure">Procedure</option>
                <option value="Surgery">Surgery</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Symptoms
            </label>
            <textarea
              name="symptoms"
              value={formData.symptoms}
              onChange={handleInputChange}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the patient's symptoms (e.g., fever, headache, cough)"
            />
            <p className="text-xs text-gray-500 mt-1">
              This helps the doctor prepare for the consultation
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any appointment notes or special instructions"
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
            <Button
              type="submit"
              disabled={
                loading ||
                !formData.patient_id ||
                !formData.doctor_id ||
                !formData.appointment_datetime
              }
            >
              {loading ? "Scheduling..." : "Schedule Appointment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
