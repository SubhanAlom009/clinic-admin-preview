/* eslint-disable @typescript-eslint/no-explicit-any */
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
    // Structured medical history fields
    allergies: "",
    chronic_conditions: "",
    medications: "",
    previous_surgeries: "",
    family_history: "",
    additional_notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate required fields
    if (!formData.name.trim()) {
      setError("Patient name is required");
      return;
    }
    if (!formData.contact.trim()) {
      setError("Contact number is required");
      return;
    }
    if (
      formData.age &&
      (parseInt(formData.age) < 0 || parseInt(formData.age) > 150)
    ) {
      setError("Please enter a valid age between 0 and 150");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Build structured medical history object
      const medicalHistory = {
        allergies: formData.allergies.trim() || null,
        chronic_conditions: formData.chronic_conditions.trim() || null,
        medications: formData.medications.trim() || null,
        previous_surgeries: formData.previous_surgeries.trim() || null,
        family_history: formData.family_history.trim() || null,
        additional_notes: formData.additional_notes.trim() || null,
      };

      // Remove null values
      const cleanedHistory = Object.fromEntries(
        Object.entries(medicalHistory).filter(([, value]) => value !== null)
      );

      const { error } = await (supabase as any).from("patients").insert({
        user_id: user.id,
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        contact: formData.contact,
        email: formData.email || null,
        address: formData.address || null,
        emergency_contact: formData.emergency_contact || null,
        medical_history:
          Object.keys(cleanedHistory).length > 0 ? cleanedHistory : null,
        medications: formData.medications
          ? formData.medications
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        previous_surgeries: formData.previous_surgeries
          ? formData.previous_surgeries
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        family_history: formData.family_history || null,
        additional_notes: formData.additional_notes || null,
      } as any);

      if (error) throw error;

      // Create success notification
      await (supabase as any).from("notifications").insert({
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
        allergies: "",
        chronic_conditions: "",
        medications: "",
        previous_surgeries: "",
        family_history: "",
        additional_notes: "",
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
      maxWidth="2xl"
    >
      {/* Basic Information Section */}
      <div className="space-y-4">
        <div className="flex items-center pb-2 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            Basic Information
          </h3>
          <span className="ml-2 text-xs text-red-500">* Required</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name *"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Enter patient's full name"
            className={!formData.name.trim() && error ? "border-red-300" : ""}
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
              { value: "", label: "Select gender" },
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Other", label: "Other" },
            ]}
          />
          <Input
            label="Contact Number *"
            name="contact"
            value={formData.contact}
            onChange={handleInputChange}
            required
            placeholder="Enter contact number"
            className={
              !formData.contact.trim() && error ? "border-red-300" : ""
            }
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
      </div>

      {/* Medical History Section */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center pb-2">
          <h3 className="text-base font-semibold text-gray-900">
            Medical History
          </h3>
          <span className="ml-2 text-xs text-gray-500">
            Optional - Can be added later
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allergies
            </label>
            <textarea
              name="allergies"
              value={formData.allergies}
              onChange={handleInputChange}
              rows={4}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Food allergies, drug allergies, etc.&#10;Each allergy on a new line"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chronic Conditions
            </label>
            <textarea
              name="chronic_conditions"
              value={formData.chronic_conditions}
              onChange={handleInputChange}
              rows={4}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Diabetes, hypertension, asthma, etc.&#10;Each condition on a new line"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Medications
            </label>
            <textarea
              name="medications"
              value={formData.medications}
              onChange={handleInputChange}
              rows={4}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Current medications and dosages&#10;Each medication on a new line"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Previous Surgeries
            </label>
            <textarea
              name="previous_surgeries"
              value={formData.previous_surgeries}
              onChange={handleInputChange}
              rows={4}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Previous surgeries and dates&#10;Each surgery on a new line"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Family History
            </label>
            <textarea
              name="family_history"
              value={formData.family_history}
              onChange={handleInputChange}
              rows={4}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Family medical history, genetic conditions, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              name="additional_notes"
              value={formData.additional_notes}
              onChange={handleInputChange}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Any other relevant medical information"
            />
          </div>
        </div>
      </div>
    </FormModal>
  );
}
