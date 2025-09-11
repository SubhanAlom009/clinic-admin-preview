import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { Appointment, Doctor } from "../../types";
import { AppointmentStatus } from "../../constants";
import { format } from "date-fns";

interface RescheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}

export function RescheduleAppointmentModal({
  isOpen,
  onClose,
  appointment,
}: RescheduleAppointmentModalProps) {
  const [formData, setFormData] = useState({
    appointment_datetime: "",
    duration_minutes: "30",
    notes: "",
  });
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
    if (appointment) {
      setFormData({
        appointment_datetime: format(
          new Date(appointment.appointment_datetime),
          "yyyy-MM-dd'T'HH:mm"
        ),
        duration_minutes: appointment.duration_minutes.toString(),
        notes: appointment.notes || "",
      });
    }
  }, [appointment]);

  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchDoctors = async () => {
      const { data } = await supabase
        .from("doctors")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (data) setDoctors(data);
    };

    fetchDoctors();
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !appointment) return;

    setLoading(true);
    setError("");

    try {
      console.log(
        "Rescheduling appointment with status:",
        AppointmentStatus.SCHEDULED
      );
      console.log("Status value being sent:", AppointmentStatus.SCHEDULED);

      const updateData = {
        appointment_datetime: new Date(
          formData.appointment_datetime
        ).toISOString(),
        duration_minutes: parseInt(formData.duration_minutes),
        notes: formData.notes || null,
        status: AppointmentStatus.SCHEDULED, // Set back to scheduled when rescheduled
        updated_at: new Date().toISOString(),
        // Reset queue fields when rescheduling
        queue_position: null,
        estimated_start_time: null,
      };

      console.log("Full update data:", updateData);
      console.log("Original datetime:", formData.appointment_datetime);
      console.log(
        "Converted to ISO:",
        new Date(formData.appointment_datetime).toISOString()
      );

      const { error } = await (supabase as any)
        .from("appointments")
        .update(updateData)
        .eq("id", appointment.id);

      if (error) {
        console.error("Database update error:", error);
        throw error;
      }

      console.log("Appointment rescheduled successfully");

      // Verify the status was set correctly by fetching the updated appointment
      const { data: updatedAppointment } = await (supabase as any)
        .from("appointments")
        .select("id, status, appointment_datetime")
        .eq("id", appointment.id)
        .single();

      if (updatedAppointment) {
        console.log("Updated appointment status:", updatedAppointment.status);
        console.log(
          "Updated appointment datetime:",
          updatedAppointment.appointment_datetime
        );
      }

      // Create notification
      await (supabase as any).from("notifications").insert({
        user_id: user.id,
        type: "appointment",
        title: "Appointment Rescheduled",
        message: `Appointment for ${
          appointment.patient?.name
        } has been rescheduled to ${format(
          new Date(formData.appointment_datetime),
          "MMM d, yyyy h:mm a"
        )}`,
        priority: "normal",
      });

      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || "Failed to reschedule appointment");
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

  if (!appointment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reschedule Appointment"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Current Appointment Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Current Appointment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Patient:</span>
              <p className="text-gray-900">{appointment.patient?.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Doctor:</span>
              <p className="text-gray-900">{appointment.doctor?.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">
                Current Date & Time:
              </span>
              <p className="text-gray-900">
                {format(
                  new Date(appointment.appointment_datetime),
                  "MMM d, yyyy h:mm a"
                )}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Duration:</span>
              <p className="text-gray-900">
                {appointment.duration_minutes} minutes
              </p>
            </div>
          </div>
        </div>

        {/* New Appointment Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            New Appointment Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="New Date & Time"
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
              Reschedule Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add any notes about the reschedule (optional)"
            />
          </div>
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
            {loading ? "Rescheduling..." : "Reschedule Appointment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
