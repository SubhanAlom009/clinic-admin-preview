import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Card } from "../ui/Card";
import { Button } from "../ui/button";
import { CheckCircle, PlayCircle, XCircle, RotateCcw } from "lucide-react";
import { Appointment } from "../../types";
import { AppointmentStatus } from "../../constants";
import { format } from "date-fns";
import { supabase } from "../../lib/supabase";

// Narrow patch type for updates to satisfy Supabase TS (fallback to any fields we added)
type AppointmentUpdatePatch = Partial<
  Pick<
    Appointment,
    | "status"
    | "patient_checked_in"
    | "checked_in_at"
    | "actual_start_time"
    | "actual_end_time"
    | "duration_minutes"
    | "updated_at"
  >
> & { [key: string]: unknown };

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onReschedule: (appointment: Appointment) => void;
  onAfterUpdate?: (updated: Partial<Appointment> & { id: string }) => void; // callback to refresh local state if desired
}

// Allowed transitions map (basic real-world guardrails)
const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CHECKED_IN]: [
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.IN_PROGRESS]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
  ], // Allow cancelling in-progress if needed
  [AppointmentStatus.COMPLETED]: [], // Completed appointments are final
  [AppointmentStatus.CANCELLED]: [AppointmentStatus.SCHEDULED], // Allow reactivating cancelled appointments
  [AppointmentStatus.NO_SHOW]: [AppointmentStatus.SCHEDULED], // Allow reactivating no-show appointments
  [AppointmentStatus.RESCHEDULED]: [AppointmentStatus.SCHEDULED], // Allow reactivating rescheduled appointments
};

// Also handle any legacy/database statuses that might exist
const legacyStatusMap: Record<string, AppointmentStatus> = {
  scheduled: AppointmentStatus.SCHEDULED,
  "checked-in": AppointmentStatus.CHECKED_IN,
  "in-progress": AppointmentStatus.IN_PROGRESS,
  completed: AppointmentStatus.COMPLETED,
  cancelled: AppointmentStatus.CANCELLED,
  "no-show": AppointmentStatus.NO_SHOW,
  rescheduled: AppointmentStatus.SCHEDULED, // rescheduled appointments should be treated as scheduled
};

export const AppointmentDetailsModal: React.FC<
  AppointmentDetailsModalProps
> = ({ isOpen, appointment, onClose, onReschedule, onAfterUpdate }) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!appointment) return null;

  // Normalize status - handle legacy/database statuses
  const normalizedStatus =
    legacyStatusMap[appointment.status?.toLowerCase()] ||
    (appointment.status as AppointmentStatus);

  // Guard against invalid status values
  if (!normalizedStatus || !allowedTransitions[normalizedStatus]) {
    console.warn("Invalid appointment status:", appointment.status);
    console.warn("Normalized status:", normalizedStatus);
    console.warn("Available statuses:", Object.keys(allowedTransitions));
    console.warn("Full appointment object:", appointment);
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Appointment Details"
        size="lg"
      >
        <div className="p-6">
          <p className="text-red-600">
            Invalid appointment status: "{appointment.status}". Please refresh
            and try again.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Expected one of: {Object.keys(allowedTransitions).join(", ")}
          </p>
        </div>
      </Modal>
    );
  }

  // Use normalized status for the rest of the component
  const currentStatus = normalizedStatus;

  const performUpdate = async (
    nextStatus: AppointmentStatus,
    extra: AppointmentUpdatePatch = {}
  ) => {
    try {
      setActionLoading(nextStatus);

      // Start with basic fields that definitely exist
      const updateData: Record<string, unknown> = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      // Only add enhanced fields if they're provided and the columns exist
      if (extra.patient_checked_in !== undefined) {
        updateData.patient_checked_in = extra.patient_checked_in;
      }
      if (extra.checked_in_at) {
        updateData.checked_in_at = extra.checked_in_at;
      }
      if (extra.actual_start_time) {
        updateData.actual_start_time = extra.actual_start_time;
      }
      if (extra.actual_end_time) {
        updateData.actual_end_time = extra.actual_end_time;
      }
      if (extra.duration_minutes !== undefined) {
        updateData.duration_minutes = extra.duration_minutes;
      }
      if (extra.diagnosis) {
        updateData.diagnosis = extra.diagnosis;
      }
      if (extra.prescription) {
        updateData.prescription = extra.prescription;
      }

      console.log("Updating appointment with data:", updateData);
      console.log("Appointment ID:", appointment.id);
      console.log("Current user ID:", appointment.user_id);

      // Workaround for supabase generated type gap: cast table to generic row shape
      // Temporary workaround: Supabase generated types missing enhanced columns -> casts to any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error, data } = await (supabase as any)
        .from("appointments")
        .update(updateData)
        .eq("id", appointment.id)
        .eq("user_id", appointment.user_id) // Ensure user can only update their own appointments
        .select();

      console.log("Supabase response:", { error, data });

      if (error) {
        console.error("Supabase error details:", error);
        throw error;
      }

      onAfterUpdate?.({ id: appointment.id, ...updateData });
      onClose();
    } catch (e) {
      console.error("Failed to update appointment", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      alert(`Failed to update appointment: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = (target: AppointmentStatus) => {
    if (!allowedTransitions[currentStatus]?.includes(target)) return;
    const extra: AppointmentUpdatePatch = {};
    switch (target) {
      case AppointmentStatus.CHECKED_IN:
        extra.patient_checked_in = true;
        extra.checked_in_at = new Date().toISOString();
        break;
      case AppointmentStatus.IN_PROGRESS:
        extra.actual_start_time = new Date().toISOString();
        break;
      case AppointmentStatus.COMPLETED:
        extra.actual_end_time = new Date().toISOString();
        // Update duration_minutes with actual consultation time if we have start time
        if (appointment.actual_start_time) {
          const actualDuration = Math.round(
            (new Date().getTime() -
              new Date(appointment.actual_start_time).getTime()) /
              (1000 * 60)
          );
          extra.duration_minutes = actualDuration;
        }
        break;
    }
    performUpdate(target, extra);
  };

  const can = (target: AppointmentStatus) =>
    allowedTransitions[currentStatus]?.includes(target) ?? false;

  const actionButtons: {
    key: string;
    label: string;
    status: string;
    icon: React.ReactNode;
    variant?: string;
    className?: string;
  }[] = [
    {
      key: "checkin",
      label: "Check In",
      status: AppointmentStatus.CHECKED_IN,
      icon: <CheckCircle className="h-4 w-4 mr-2" />,
      className:
        "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100",
    },
    {
      key: "start",
      label: "Start",
      status: AppointmentStatus.IN_PROGRESS,
      icon: <PlayCircle className="h-4 w-4 mr-2" />,
      className: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
    },
    {
      key: "complete",
      label: "Complete",
      status: AppointmentStatus.COMPLETED,
      icon: <CheckCircle className="h-4 w-4 mr-2" />,
      className:
        "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
    },
    {
      key: "noshow",
      label: "No Show",
      status: AppointmentStatus.NO_SHOW,
      icon: <XCircle className="h-4 w-4 mr-2" />,
      className: "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
    },
    {
      key: "cancel",
      label: "Cancel",
      status: AppointmentStatus.CANCELLED,
      icon: <XCircle className="h-4 w-4 mr-2" />,
      className: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Appointment Details"
      size="lg"
    >
      <div className="p-6 space-y-6">
        {/* Header with Date/Time in top right */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-8 bg-orange-400 rounded-full"></div>
            <h3 className="text-lg font-medium text-gray-900">
              Appointment Details
            </h3>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-600">
              {format(
                new Date(appointment.appointment_datetime),
                "MMM dd, yyyy"
              )}
            </p>
            <p className="text-xs text-gray-500">
              {format(new Date(appointment.appointment_datetime), "hh:mm a")} •{" "}
              {appointment.duration_minutes || 30} min
              {appointment.actual_start_time &&
                appointment.actual_end_time &&
                appointment.duration_minutes !==
                  Math.round(
                    (new Date(appointment.actual_end_time).getTime() -
                      new Date(appointment.actual_start_time).getTime()) /
                      (1000 * 60)
                  ) && (
                  <span className="text-orange-600">
                    {" "}
                    (actual:{" "}
                    {Math.round(
                      (new Date(appointment.actual_end_time).getTime() -
                        new Date(appointment.actual_start_time).getTime()) /
                        (1000 * 60)
                    )}{" "}
                    min)
                  </span>
                )}
            </p>
          </div>
        </div>

        {/* Main Info Card */}
        <Card className="p-6 bg-white border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Patient Information */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Patient Information
                </h4>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-gray-900">
                    {appointment.patient?.name || "Unknown Patient"}
                  </p>
                  <div className="space-y-1">
                    {appointment.patient?.contact && (
                      <p className="text-sm text-gray-600">
                        Phone: {appointment.patient.contact}
                      </p>
                    )}
                    {appointment.patient?.email && (
                      <p className="text-sm text-gray-600">
                        Email: {appointment.patient.email}
                      </p>
                    )}
                    <div className="flex space-x-4 text-sm text-gray-600">
                      {appointment.patient?.age && (
                        <span>Age: {appointment.patient.age}</span>
                      )}
                      {appointment.patient?.gender && (
                        <span>Gender: {appointment.patient.gender}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Doctor Information */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Doctor Information
                </h4>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-gray-900">
                    Dr. {appointment.doctor?.name || "Unknown Doctor"}
                  </p>
                  <div className="space-y-1">
                    {appointment.doctor?.specialization && (
                      <p className="text-sm text-gray-600">
                        Specialization: {appointment.doctor.specialization}
                      </p>
                    )}
                    {appointment.doctor?.experience_years && (
                      <p className="text-sm text-gray-600">
                        Experience: {appointment.doctor.experience_years} years
                      </p>
                    )}
                    {appointment.doctor?.consultation_fee && (
                      <p className="text-sm text-gray-600">
                        Consultation Fee: ₹{appointment.doctor.consultation_fee}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Medical Information Section */}
          {appointment.patient && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-lg font-semibold text-gray-800 mb-6">
                Medical Information
              </h4>

              <div className="space-y-6">
                {/* Allergies */}
                {appointment.patient.allergies &&
                  appointment.patient.allergies.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        Allergies
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                        {appointment.patient.allergies.map((allergy, index) => (
                          <li key={index}>{allergy}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Current Medications */}
                {appointment.patient.medications &&
                  appointment.patient.medications.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        Current Medications
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                        {appointment.patient.medications.map(
                          (medication, index) => (
                            <li key={index}>{medication}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                {/* Previous Surgeries */}
                {appointment.patient.previous_surgeries &&
                  appointment.patient.previous_surgeries.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        Previous Surgeries
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                        {appointment.patient.previous_surgeries.map(
                          (surgery, index) => (
                            <li key={index}>{surgery}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                {/* Family History */}
                {appointment.patient.family_history && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-600 mb-2">
                      Family History
                    </h5>
                    <p className="text-sm text-gray-700 ml-4">
                      {appointment.patient.family_history}
                    </p>
                  </div>
                )}

                {/* Additional Notes */}
                {appointment.patient.additional_notes && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-600 mb-2">
                      Additional Notes
                    </h5>
                    <p className="text-sm text-gray-700 ml-4">
                      {appointment.patient.additional_notes}
                    </p>
                  </div>
                )}

                {/* Emergency Contact */}
                {appointment.patient.emergency_contact && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-600 mb-2">
                      Emergency Contact
                    </h5>
                    <p className="text-sm text-gray-700 ml-4">
                      {appointment.patient.emergency_contact}
                    </p>
                  </div>
                )}

                {/* Show message if no medical information is available */}
                {!appointment.patient.allergies?.length &&
                  !appointment.patient.medications?.length &&
                  !appointment.patient.previous_surgeries?.length &&
                  !appointment.patient.family_history &&
                  !appointment.patient.additional_notes &&
                  !appointment.patient.emergency_contact && (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-500">
                        No medical information available for this patient
                      </p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Status and Queue Information */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Appointment Status
            </h4>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Status:</span>
                <span
                  className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                    currentStatus === AppointmentStatus.SCHEDULED
                      ? "bg-blue-100 text-blue-800"
                      : currentStatus === AppointmentStatus.CHECKED_IN
                      ? "bg-orange-100 text-orange-800"
                      : currentStatus === AppointmentStatus.IN_PROGRESS
                      ? "bg-purple-100 text-purple-800"
                      : currentStatus === AppointmentStatus.COMPLETED
                      ? "bg-green-100 text-green-800"
                      : currentStatus === AppointmentStatus.CANCELLED
                      ? "bg-red-100 text-red-800"
                      : currentStatus === AppointmentStatus.NO_SHOW
                      ? "bg-gray-100 text-gray-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {currentStatus}
                </span>
              </div>
              {typeof appointment.queue_position === "number" && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Queue Position:</span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                    #{appointment.queue_position}
                  </span>
                </div>
              )}
              {/* ETA removed: estimated_start_time is managed server-side/queue system and not shown in UI */}
              {appointment.checked_in_at && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Checked In:</span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                    {format(new Date(appointment.checked_in_at), "hh:mm a")}
                  </span>
                </div>
              )}
              {appointment.actual_start_time && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Started:</span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                    {format(new Date(appointment.actual_start_time), "hh:mm a")}
                  </span>
                </div>
              )}
              {appointment.actual_end_time && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Ended:</span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    {format(new Date(appointment.actual_end_time), "hh:mm a")}
                  </span>
                </div>
              )}
            </div>

            {/* Timing Analysis (if applicable) */}
            {(appointment.checked_in_at ||
              appointment.actual_start_time ||
              appointment.actual_end_time) && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h5 className="text-sm font-medium text-gray-700 mb-3">
                  Timing Details
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {appointment.checked_in_at &&
                    appointment.actual_start_time && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-blue-700 font-medium">
                          Waiting Time
                        </p>
                        <p className="text-blue-600">
                          {Math.round(
                            (new Date(appointment.actual_start_time).getTime() -
                              new Date(appointment.checked_in_at).getTime()) /
                              (1000 * 60)
                          )}{" "}
                          minutes
                        </p>
                      </div>
                    )}
                  {appointment.actual_start_time &&
                    appointment.actual_end_time && (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-green-700 font-medium">
                          Actual Consultation Duration
                        </p>
                        <p className="text-green-600">
                          {Math.round(
                            (new Date(appointment.actual_end_time).getTime() -
                              new Date(
                                appointment.actual_start_time
                              ).getTime()) /
                              (1000 * 60)
                          )}{" "}
                          minutes
                          {appointment.duration_minutes && (
                            <span className="text-gray-500 text-xs block">
                              (Planned: {appointment.duration_minutes} min)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  {/* {appointment.estimated_start_time &&
                    appointment.actual_start_time && (
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <p className="text-yellow-700 font-medium">
                          Schedule Variance
                        </p>
                        <p className="text-yellow-600">
                          {Math.round(
                            (new Date(appointment.actual_start_time).getTime() -
                              new Date(
                                appointment.estimated_start_time
                              ).getTime()) /
                              (1000 * 60)
                          )}{" "}
                          minutes{" "}
                          {new Date(appointment.actual_start_time).getTime() >
                          new Date(appointment.estimated_start_time).getTime()
                            ? "late"
                            : "early"}
                        </p>
                      </div>
                    )} */}
                </div>
              </div>
            )}

            {/* Appointment Details */}
            <div className="space-y-4">
              {appointment.symptoms && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Symptoms
                  </h5>
                  <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                    {appointment.symptoms}
                  </p>
                </div>
              )}
              {appointment.notes && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </h5>
                  <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                    {appointment.notes}
                  </p>
                </div>
              )}
              {appointment.diagnosis && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Diagnosis
                  </h5>
                  <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                    {appointment.diagnosis}
                  </p>
                </div>
              )}
              {appointment.prescription && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Prescription
                  </h5>
                  <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                    {appointment.prescription}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Actions
          </h4>
          <div className="flex flex-wrap gap-3">
            {actionButtons
              .filter((b) => can(b.status as AppointmentStatus))
              .map((b) => (
                <Button
                  key={b.key}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(b.status as AppointmentStatus)}
                  disabled={actionLoading === b.status}
                  className="text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  {b.icon}
                  {b.label}
                </Button>
              ))}

            {/* Reschedule Button */}
            {(currentStatus === AppointmentStatus.SCHEDULED ||
              currentStatus === AppointmentStatus.CHECKED_IN) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReschedule(appointment)}
                className="text-orange-700 border-orange-300 hover:bg-orange-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Reschedule
              </Button>
            )}

            {/* Completed Status Actions */}
            {currentStatus === AppointmentStatus.COMPLETED && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    alert("Billing feature coming soon!");
                  }}
                  className="text-green-700 border-green-300 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4 mr-2" /> Generate Bill
                </Button>
                {!appointment.diagnosis && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const diagnosis = prompt("Enter diagnosis:");
                      if (diagnosis) {
                        performUpdate(currentStatus, { diagnosis });
                      }
                    }}
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                  >
                    Add Diagnosis
                  </Button>
                )}
                {!appointment.prescription && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prescription = prompt("Enter prescription:");
                      if (prescription) {
                        performUpdate(currentStatus, { prescription });
                      }
                    }}
                    className="text-purple-700 border-purple-300 hover:bg-purple-50"
                  >
                    Add Prescription
                  </Button>
                )}
              </>
            )}

            {/* In-Progress Status Actions */}
            {currentStatus === AppointmentStatus.IN_PROGRESS && (
              <>
                {!appointment.diagnosis && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const diagnosis = prompt("Enter diagnosis:");
                      if (diagnosis) {
                        performUpdate(currentStatus, { diagnosis });
                      }
                    }}
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                  >
                    Add Diagnosis
                  </Button>
                )}
                {!appointment.prescription && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prescription = prompt("Enter prescription:");
                      if (prescription) {
                        performUpdate(currentStatus, { prescription });
                      }
                    }}
                    className="text-purple-700 border-purple-300 hover:bg-purple-50"
                  >
                    Add Prescription
                  </Button>
                )}
              </>
            )}

            {/* Reactivate Button for Cancelled/No-Show */}
            {(currentStatus === AppointmentStatus.CANCELLED ||
              currentStatus === AppointmentStatus.NO_SHOW) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction(AppointmentStatus.SCHEDULED)}
                disabled={actionLoading === AppointmentStatus.SCHEDULED}
                className="text-blue-700 border-blue-300 hover:bg-blue-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Reactivate
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
