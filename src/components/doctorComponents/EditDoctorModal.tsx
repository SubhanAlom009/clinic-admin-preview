import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { Doctor } from "../../types";

interface EditDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
}

export function EditDoctorModal({
  isOpen,
  onClose,
  doctor,
}: EditDoctorModalProps) {
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

  useEffect(() => {
    if (doctor) {
      setFormData({
        name: doctor.name,
        specialization: doctor.specialization,
        qualifications: doctor.qualifications || "",
        contact: doctor.contact,
        email: doctor.email || "",
        consultation_fee: doctor.consultation_fee.toString(),
        experience_years: doctor.experience_years.toString(),
      });
    }
  }, [doctor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !doctor) return;

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase
        .from("doctors")
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", doctor.id);

      if (error) throw error;

      // Create success notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "system",
        title: "Doctor Updated",
        message: `Dr. ${formData.name} has been updated successfully.`,
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Doctor" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
            {loading ? "Updating..." : "Update Doctor"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
