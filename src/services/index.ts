/**
 * Services Index
 * Centralizes all service exports
 */

export { BaseService } from "./BaseService";
export { AppointmentService } from "./AppointmentService";
export type {
  CreateAppointmentData,
  UpdateAppointmentData,
} from "./AppointmentService";
export type { ServiceResponse } from "./BaseService";

// Future services to be added:
// export { PatientService } from './PatientService';
// export { DoctorService } from './DoctorService';
// export { BillingService } from './BillingService';
// export { NotificationService } from './NotificationService';
