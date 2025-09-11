import React, { useState } from "react";
import { FormModal } from "../ui/FormModal";
import { Input } from "../ui/Input";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { VALIDATION_RULES } from "../../constants";

interface AddDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddDoctorModal({ isOpen, onClose }: AddDoctorModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    specialization: "",
    qualifications: "",
    contact: "",
    email: "",
    consultation_fee: "",
    experience_years: "",
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
      // Validate email format if provided
      if (
        formData.email &&
        !VALIDATION_RULES.EMAIL_REGEX.test(formData.email)
      ) {
        throw new Error("Please enter a valid email address");
      }

      // Validate contact format
      if (!VALIDATION_RULES.PHONE_REGEX.test(formData.contact)) {
        throw new Error("Please enter a valid phone number");
      }

      const { error } = await supabase.from("doctors").insert({
        user_id: user.id,
        name: formData.name,
        specialization: formData.specialization,
        qualifications: formData.qualifications || null,
        contact: formData.contact,
        email: formData.email || null,
        consultation_fee: formData.consultation_fee
          ? parseFloat(formData.consultation_fee)
          : 0,
        experience_years: formData.experience_years
          ? parseInt(formData.experience_years)
          : 0,
      } as any);

      if (error) throw error;

      // Create success notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "system",
        title: "Doctor Added",
        message: `Dr. ${formData.name} has been added successfully.`,
        priority: "normal",
      } as any);

      onClose();
      setFormData({
        name: "",
        specialization: "",
        qualifications: "",
        contact: "",
        email: "",
        consultation_fee: "",
        experience_years: "",
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      title="Add New Doctor"
      onSubmit={handleSubmit}
      isLoading={loading}
      error={error}
      submitText={loading ? "Adding..." : "Add Doctor"}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Full Name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          required
          placeholder="Enter doctor's full name"
        />
        <Input
          label="Specialization"
          name="specialization"
          value={formData.specialization}
          onChange={handleInputChange}
          required
          placeholder="e.g., Cardiologist, Dermatologist"
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
          label="Consultation Fee (₹)"
          name="consultation_fee"
          type="number"
          step="0.01"
          value={formData.consultation_fee}
          onChange={handleInputChange}
          placeholder="Enter consultation fee"
        />
        <Input
          label="Years of Experience"
          name="experience_years"
          type="number"
          value={formData.experience_years}
          onChange={handleInputChange}
          placeholder="Enter years of experience"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Qualifications
        </label>
        <textarea
          name="qualifications"
          value={formData.qualifications}
          onChange={handleInputChange}
          rows={3}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter qualifications and certifications"
        />
      </div>
    </FormModal>
  );
}
