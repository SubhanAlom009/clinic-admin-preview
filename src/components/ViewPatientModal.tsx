import React from "react";
import { Modal } from "./ui/Modal";
import {
  User,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Calendar,
  FileText,
} from "lucide-react";
import { Patient } from "../types";
import { format } from "date-fns";

interface ViewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export function ViewPatientModal({
  isOpen,
  onClose,
  patient,
}: ViewPatientModalProps) {
  if (!patient) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Patient Details" size="lg">
      <div className="p-6 space-y-6">
        {/* Basic Information */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <p className="text-gray-900 font-medium">{patient.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Age
              </label>
              <p className="text-gray-900">
                {patient.age ? `${patient.age} years` : "Not specified"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Gender
              </label>
              <p className="text-gray-900">
                {patient.gender || "Not specified"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Registration Date
              </label>
              <p className="text-gray-900">
                {format(new Date(patient.created_at), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center">
            <Phone className="h-5 w-5 mr-2" />
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <p className="text-gray-900 font-medium">{patient.contact}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <p className="text-gray-900">{patient.email || "Not provided"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Emergency Contact
              </label>
              <p className="text-gray-900">
                {patient.emergency_contact || "Not provided"}
              </p>
            </div>
          </div>
          {patient.address && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-gray-500 mr-2 mt-1 flex-shrink-0" />
                <p className="text-gray-900">{patient.address}</p>
              </div>
            </div>
          )}
        </div>

        {/* Medical History */}
        {patient.medical_history && (
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Medical History
            </h3>
            <div className="text-gray-900 text-sm">
              {typeof patient.medical_history === "string" ? (
                <p className="whitespace-pre-wrap">{patient.medical_history}</p>
              ) : typeof patient.medical_history === "object" &&
                patient.medical_history !== null ? (
                Object.keys(patient.medical_history).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(patient.medical_history).map(
                      ([key, value]) => (
                        <div key={key}>
                          <span className="font-medium text-red-800 capitalize">
                            {key.replace("_", " ")}:
                          </span>
                          <span className="ml-2 text-gray-700">
                            {String(value)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-gray-600 italic">
                    No medical history recorded
                  </p>
                )
              ) : (
                <p className="text-gray-600 italic">
                  No medical history recorded
                </p>
              )}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-center text-sm text-gray-500 border-t pt-4">
          Last updated:{" "}
          {format(new Date(patient.updated_at), "MMM d, yyyy h:mm a")}
        </div>
      </div>
    </Modal>
  );
}
