/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { AlertTriangle, Heart, Pill, FileText } from "lucide-react";
import { FormModal } from "../ui/FormModal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";

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
      onSubmit={handleSubmit}
      submitText={loading ? "Adding..." : "Add Patient"}
      submitVariant="primary"
      isLoading={loading}
      error={error}
      maxWidth="3xl"
    >
      {/* Basic Information Section (two-column) */}
      <div className="space-y-4">
        <div className="flex items-center pb-2 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Basic Information
          </h3>
          <span className="ml-2 text-xs text-red-500">* Required</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Enter patient's full name"
            className="rounded-lg shadow-sm"
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
            className="rounded-lg shadow-sm"
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
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Contact Number"
            name="contact"
            value={formData.contact}
            onChange={handleInputChange}
            required
            placeholder="Enter contact number"
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter email address"
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Emergency Contact"
            name="emergency_contact"
            value={formData.emergency_contact}
            onChange={handleInputChange}
            placeholder="Enter emergency contact"
            className="rounded-lg shadow-sm"
          />
        </div>

        <Input
          label="Address"
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          placeholder="Enter complete address"
          className="rounded-lg shadow-sm"
        />
      </div>

      {/* Medical History (accordion sections) */}
      <div className="space-y-3 border-t pt-6">
        <div className="flex items-center pb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Medical History
          </h3>
          <span className="ml-2 text-sm text-gray-500">
            Optional — expand sections to edit
          </span>
        </div>

        <div className="space-y-2">
          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="font-medium text-gray-800">Allergies</span>
              </div>
              <span className="text-sm text-gray-500 group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="allergies"
                value={formData.allergies}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="List allergies, one per line"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-orange-500" />
                <span className="font-medium text-gray-800">
                  Chronic Conditions
                </span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="chronic_conditions"
                value={formData.chronic_conditions}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="List chronic conditions, one per line"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <Pill className="h-5 w-5 text-blue-500" />
                <span className="font-medium text-gray-800">Medications</span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="medications"
                value={formData.medications}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="List medications and dosages, one per line"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-500" />
                <span className="font-medium text-gray-800">
                  Previous Surgeries
                </span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="previous_surgeries"
                value={formData.previous_surgeries}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="List surgeries and dates, one per line"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-800">
                  Family History
                </span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="family_history"
                value={formData.family_history}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="Family medical history, one per line or short paragraph"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-500" />
                <span className="font-medium text-gray-800">
                  Additional Notes
                </span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="additional_notes"
                value={formData.additional_notes}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="Any other relevant medical details"
              />
            </div>
          </details>
        </div>
      </div>
    </FormModal>
  );
}
