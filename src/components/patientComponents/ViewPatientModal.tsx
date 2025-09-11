import { Modal } from "../ui/Modal";
import {
  User,
  MapPin,
  FileText,
  Edit,
  Phone,
  Calendar,
  Mail,
  Tag,
} from "lucide-react";
import { Patient } from "../../types";
import { format } from "date-fns";

interface ViewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  patient: Patient | null;
}

export function ViewPatientModal({
  isOpen,
  onClose,
  onEdit,
  patient,
}: ViewPatientModalProps) {
  if (!patient) return null;

  // optional avatar field - safe read in case db has `avatar_url` or `photo_url`
  const pRec = patient as unknown as Record<string, unknown>;
  const avatar =
    (pRec["avatar_url"] as string | undefined) ??
    (pRec["photo_url"] as string | undefined) ??
    null;

  // normalize medical history fields: prefer top-level columns, fall back to patient.medical_history JSON
  const mh = (patient.medical_history ?? {}) as Record<string, unknown>;
  const extractArray = (key: string): string[] | undefined => {
    const v = mh[key];
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string")
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return undefined;
  };
  const extractText = (key: string): string | undefined => {
    const v = mh[key];
    if (v === null || v === undefined) return undefined;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
    return String(v);
  };

  const allergies =
    patient.allergies && (patient.allergies.length ?? 0) > 0
      ? patient.allergies
      : extractArray("allergies") ?? [];
  const chronic =
    patient.chronic_conditions && (patient.chronic_conditions.length ?? 0) > 0
      ? patient.chronic_conditions
      : extractArray("chronic_conditions") ?? extractArray("conditions") ?? [];
  const medications =
    patient.medications && (patient.medications.length ?? 0) > 0
      ? patient.medications
      : extractArray("medications") ?? extractArray("meds") ?? [];
  const surgeries =
    patient.previous_surgeries && (patient.previous_surgeries.length ?? 0) > 0
      ? patient.previous_surgeries
      : extractArray("previous_surgeries") ?? extractArray("surgeries") ?? [];
  const familyHistory =
    patient.family_history ?? extractText("family_history") ?? undefined;
  const additionalNotes =
    patient.additional_notes ?? extractText("additional_notes") ?? undefined;

  // compact list of summary tags was removed — inline tag rendering is used below

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Patient Details" size="lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
              {avatar ? (
                <img
                  src={avatar}
                  alt={`${patient.name} avatar`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-gray-400" />
              )}
            </div>

            <div>
              <div className="text-xs text-gray-500">Patient</div>
              <div className="text-2xl font-semibold text-gray-900">
                {patient.name}
              </div>
              <div className="flex items-center text-sm text-gray-600 gap-3 mt-1">
                <div className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{patient.contact}</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{patient.email ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-4">
            <div className="text-right text-sm text-gray-500">
              <div className="flex items-center gap-2 justify-end">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="text-xs">Registered</div>
                  <div className="font-medium text-gray-800">
                    {format(new Date(patient.created_at), "MMM d, yyyy")}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={() => onEdit?.()}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded shadow-sm text-sm hover:bg-teal-700"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Two-column compact details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Age</div>
              <div className="text-lg font-medium text-gray-900">
                {patient.age ? `${patient.age} yrs` : "—"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Gender</div>
              <div className="text-lg font-medium text-gray-900">
                {patient.gender ?? "—"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Emergency Contact</div>
              <div className="text-lg font-medium text-gray-900">
                {patient.emergency_contact ?? "—"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Address</div>
              <div className="text-sm text-gray-800 flex items-start gap-2 mt-1">
                <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                <div>{patient.address ?? "—"}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Patient ID</div>
              <div className="text-sm text-gray-800">{patient.id}</div>
            </div>
          </div>
        </div>

        {/* Medical History summary */}
        {((allergies && allergies.length > 0) ||
          (chronic && chronic.length > 0) ||
          (medications && medications.length > 0) ||
          (surgeries && surgeries.length > 0) ||
          familyHistory ||
          additionalNotes ||
          (patient.medical_history &&
            Object.keys(patient.medical_history).length > 0)) && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                Medical History
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-4 align-top w-40 text-xs text-gray-500">
                      Allergies
                    </th>
                    <td className="py-2 text-gray-800">
                      {allergies && allergies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {allergies.map((a, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>

                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-4 align-top text-xs text-gray-500">
                      Chronic Conditions
                    </th>
                    <td className="py-2 text-gray-800">
                      {chronic && chronic.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {chronic.map((c, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>

                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-4 align-top text-xs text-gray-500">
                      Medications
                    </th>
                    <td className="py-2 text-gray-800">
                      {medications && medications.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                          {medications.map((m, i) => (
                            <li key={i} className="text-sm text-gray-800">
                              {m}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>

                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-4 align-top text-xs text-gray-500">
                      Previous Surgeries
                    </th>
                    <td className="py-2 text-gray-800">
                      {surgeries && surgeries.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                          {surgeries.map((s, i) => (
                            <li key={i} className="text-sm text-gray-800">
                              {s}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>

                  <tr className="border-b border-gray-100">
                    <th className="py-2 pr-4 align-top text-xs text-gray-500">
                      Family History
                    </th>
                    <td className="py-2 text-gray-800 whitespace-pre-wrap">
                      {familyHistory ?? (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <th className="py-2 pr-4 align-top text-xs text-gray-500">
                      Additional Notes
                    </th>
                    <td className="py-2 text-gray-800 whitespace-pre-wrap">
                      {additionalNotes ?? (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
