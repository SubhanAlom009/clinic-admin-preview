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
  Heart,
  Pill,
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
        {((patient.allergies && patient.allergies.length > 0) ||
          (patient.chronic_conditions &&
            patient.chronic_conditions.length > 0) ||
          (patient.medications && patient.medications.length > 0) ||
          (patient.previous_surgeries &&
            patient.previous_surgeries.length > 0) ||
          patient.family_history ||
          patient.additional_notes ||
          (patient.medical_history &&
            Object.keys(patient.medical_history).length > 0)) && (
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Medical History
            </h3>

            <div className="space-y-4">
              {/* Allergies */}
              {patient.allergies && patient.allergies.length > 0 && (
                <div className="bg-white rounded-lg p-3 border-l-4 border-red-400">
                  <h4 className="font-medium text-red-800 mb-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Allergies
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {patient.allergies.map((allergy, index) => (
                      <li key={index} className="flex items-center">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                        {allergy}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Chronic Conditions */}
              {patient.chronic_conditions &&
                patient.chronic_conditions.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border-l-4 border-orange-400">
                    <h4 className="font-medium text-orange-800 mb-2 flex items-center">
                      <Heart className="h-4 w-4 mr-1" />
                      Chronic Conditions
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {patient.chronic_conditions.map((condition, index) => (
                        <li key={index} className="flex items-center">
                          <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                          {condition}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Current Medications */}
              {patient.medications && patient.medications.length > 0 && (
                <div className="bg-white rounded-lg p-3 border-l-4 border-blue-400">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                    <Pill className="h-4 w-4 mr-1" />
                    Current Medications
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {patient.medications.map((medication, index) => (
                      <li key={index} className="flex items-center">
                        <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                        {medication}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Previous Surgeries */}
              {patient.previous_surgeries &&
                patient.previous_surgeries.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border-l-4 border-purple-400">
                    <h4 className="font-medium text-purple-800 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-1" />
                      Previous Surgeries
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {patient.previous_surgeries.map((surgery, index) => (
                        <li key={index} className="flex items-center">
                          <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                          {surgery}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Family History */}
              {patient.family_history && (
                <div className="bg-white rounded-lg p-3 border-l-4 border-green-400">
                  <h4 className="font-medium text-green-800 mb-2">
                    Family History
                  </h4>
                  <p className="text-sm text-gray-700">
                    {patient.family_history}
                  </p>
                </div>
              )}

              {/* Additional Notes */}
              {patient.additional_notes && (
                <div className="bg-white rounded-lg p-3 border-l-4 border-gray-400">
                  <h4 className="font-medium text-gray-800 mb-2">
                    Additional Notes
                  </h4>
                  <p className="text-sm text-gray-700">
                    {patient.additional_notes}
                  </p>
                </div>
              )}

              {/* Legacy Medical History */}
              {patient.medical_history &&
                Object.keys(patient.medical_history).length > 0 && (
                  <div className="bg-white rounded-lg p-3 border-l-4 border-indigo-400">
                    <h4 className="font-medium text-indigo-800 mb-2">
                      Legacy Medical History
                    </h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      {Object.entries(patient.medical_history).map(
                        ([key, value]) => (
                          <div key={key}>
                            <span className="font-medium text-indigo-700 capitalize">
                              {key.replace("_", " ")}:
                            </span>
                            <span className="ml-2">{String(value)}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
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
