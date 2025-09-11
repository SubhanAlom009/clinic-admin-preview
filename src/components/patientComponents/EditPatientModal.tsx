/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { AlertTriangle, Heart, Pill, FileText } from "lucide-react";
import { FormModal } from "../ui/FormModal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { Patient } from "../../types";

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

  useEffect(() => {
    if (patient) {
      // Convert arrays back to strings for editing
      const allergiesText = patient.allergies?.join("\n") || "";
      const conditionsText = patient.chronic_conditions?.join("\n") || "";
      const medicationsText = patient.medications?.join("\n") || "";
      const surgeriesText = patient.previous_surgeries?.join("\n") || "";

      setFormData({
        name: patient.name,
        age: patient.age?.toString() || "",
        gender: patient.gender || "",
        contact: patient.contact,
        email: patient.email || "",
        address: patient.address || "",
        emergency_contact: patient.emergency_contact || "",
        allergies: allergiesText,
        chronic_conditions: conditionsText,
        medications: medicationsText,
        previous_surgeries: surgeriesText,
        family_history: patient.family_history || "",
        additional_notes: patient.additional_notes || "",
      });
    }
  }, [patient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !patient) return;

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
      // Convert multi-line fields into arrays for consistent DB types
      const toArray = (s: string) =>
        s && s.trim()
          ? s
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean)
          : null;

      const allergiesArr = toArray(formData.allergies);
      const conditionsArr = toArray(formData.chronic_conditions);
      const medicationsArr = toArray(formData.medications);
      const surgeriesArr = toArray(formData.previous_surgeries);

      // Build structured medical_history with arrays where appropriate
      const medicalHistoryObj: Record<string, unknown> = {};
      if (allergiesArr) medicalHistoryObj.allergies = allergiesArr;
      if (conditionsArr) medicalHistoryObj.chronic_conditions = conditionsArr;
      if (medicationsArr) medicalHistoryObj.medications = medicationsArr;
      if (surgeriesArr) medicalHistoryObj.previous_surgeries = surgeriesArr;
      if (formData.family_history?.trim())
        medicalHistoryObj.family_history = formData.family_history.trim();
      if (formData.additional_notes?.trim())
        medicalHistoryObj.additional_notes = formData.additional_notes.trim();

      // Build payload only with keys we want to send
      const payload: Record<string, unknown> = {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        contact: formData.contact,
        email: formData.email || null,
        address: formData.address || null,
        emergency_contact: formData.emergency_contact || null,
        updated_at: new Date().toISOString(),
      };

      // Attach arrays/top-level fields
      payload.medications = medicationsArr;
      payload.previous_surgeries = surgeriesArr;
      payload.allergies = allergiesArr;
      payload.chronic_conditions = conditionsArr;
      payload.family_history = formData.family_history || null;
      payload.additional_notes = formData.additional_notes || null;

      // Attach medical_history JSON if any
      payload.medical_history =
        Object.keys(medicalHistoryObj).length > 0 ? medicalHistoryObj : null;

      // Helper: attempt update, and if PostgREST complains about missing column
      // (PGRST204 / "Could not find the 'X' column"), remove the column and retry.
      const attemptUpdate = async (initialPayload: Record<string, unknown>) => {
        const maxTries = 5;
        const payloadToSend = { ...initialPayload };
        for (let attempt = 1; attempt <= maxTries; attempt++) {
          const { error } = await (supabase as any)
            .from("patients")
            .update(payloadToSend)
            .match({ id: patient.id });

          if (!error) return null;

          const msg: string = (error &&
            (error.message || error.msg || "")) as string;
          // If message indicates missing column, extract column and remove from payload
          const m = msg.match(/Could not find the '([^']+)' column/);
          if (m && m[1]) {
            const missingCol = m[1];
            // If the payload doesn't contain that key, give up
            if (!(missingCol in payloadToSend)) return error;
            // remove the offending key and retry
            delete (payloadToSend as any)[missingCol];
            // continue to next attempt
            continue;
          }

          // Not a schema-missing error, return the error
          return error;
        }

        return new Error(
          "Failed to update patient after removing missing columns"
        );
      };

      const updateError = await attemptUpdate(payload);
      if (updateError) {
        console.error("Supabase update error:", updateError);
        throw updateError;
      }

      // Create success notification
      await (supabase as any).from("notifications").insert({
        user_id: user.id,
        type: "system",
        title: "Patient Updated",
        message: `Patient ${formData.name} has been updated successfully.`,
        priority: "normal",
      } as any);

      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || "An error occurred while updating the patient");
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
      title="Edit Patient"
      description="Update patient information"
      onSubmit={handleSubmit}
      submitText={loading ? "Updating..." : "Update Patient"}
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
