import React, { useState } from "react";
import { FormModal } from "./ui/FormModal";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPatientModal({ isOpen, onClose }: AddPatientModalProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("patients").insert({
        user_id: user.id,
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        contact: formData.contact,
        email: formData.email || null,
        address: formData.address || null,
        emergency_contact: formData.emergency_contact || null,
        medical_history: medicalHistory,
      } as any);

      if (error) throw error;

      // Create success notification
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "system",
        title: "Patient Added",
        message: `New patient ${formData.name} has been added successfully.`,
        priority: "normal",
      } as any);

      onClose();
      setFormData({
        name: "",
        age: "",
        gender: "",
        contact: "",
        email: "",
        address: "",
        emergency_contact: "",
        medical_history: "",
      });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || "An error occurred while adding the patient");
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
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Patient"
      description="Enter patient information to add them to the system"
      onSubmit={handleSubmit}
      submitText={loading ? "Adding..." : "Add Patient"}
      isLoading={loading}
      error={error}
      maxWidth="lg"
    >
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
          placeholder="Enter medical history, allergies, chronic conditions, etc."
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter any relevant medical history, allergies, or chronic conditions
        </p>
      </div>
    </FormModal>
  );
}
