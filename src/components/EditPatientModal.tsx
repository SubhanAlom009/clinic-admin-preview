import React, { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Patient } from "../types";

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export function EditPatientModal({
  isOpen,
  onClose,
  patient,
}: EditPatientModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    contact: "",
    email: "",
    address: "",
    emergency_contact: "",
    medical_history: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name,
        age: patient.age?.toString() || "",
        gender: patient.gender || "",
        contact: patient.contact,
        email: patient.email || "",
        address: patient.address || "",
        emergency_contact: patient.emergency_contact || "",
        medical_history: patient.medical_history
          ? JSON.stringify(patient.medical_history, null, 2)
          : "",
      });
    }
  }, [patient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !patient) return;

    setLoading(true);
    setError("");

    try {
      let medicalHistory = {};
      if (formData.medical_history.trim()) {
        try {
          medicalHistory = JSON.parse(formData.medical_history);
        } catch {
          medicalHistory = { notes: formData.medical_history };
        }
      }

      const { error } = await supabase
        .from("patients")
        .update({
          name: formData.name,
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender || null,
          contact: formData.contact,
          email: formData.email || null,
          address: formData.address || null,
          emergency_contact: formData.emergency_contact || null,
          medical_history: medicalHistory,
          updated_at: new Date().toISOString(),
        })
        .eq("id", patient.id);

      if (error) throw error;

      // Create success notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "system",
        title: "Patient Updated",
        message: `Patient ${formData.name} has been updated successfully.`,
        priority: "normal",
      });

      onClose();
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
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Patient" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Enter patient's full name"
          />
          <Input
            label="Age"
            name="age"
            type="number"
            value={formData.age}
            onChange={handleInputChange}
            placeholder="Enter age"
            min="0"
            max="150"
          />
          <Select
            label="Gender"
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            options={[
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Other", label: "Other" },
            ]}
          />
          <Input
            label="Contact Number"
            name="contact"
            value={formData.contact}
            onChange={handleInputChange}
            required
            placeholder="Enter contact number"
          />
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter email address"
          />
          <Input
            label="Emergency Contact"
            name="emergency_contact"
            value={formData.emergency_contact}
            onChange={handleInputChange}
            placeholder="Enter emergency contact"
          />
        </div>

        <Input
          label="Address"
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          placeholder="Enter complete address"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Medical History
          </label>
          <textarea
            name="medical_history"
            value={formData.medical_history}
            onChange={handleInputChange}
            rows={4}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter medical history (JSON format or plain text)"
          />
          <p className="text-xs text-gray-500 mt-1">
            You can enter plain text or JSON format for structured data
          </p>
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
            {loading ? "Updating..." : "Update Patient"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
