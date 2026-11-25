export type AppointmentStatus =
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'completed';

export type VisitMode = 'in-person' | 'telehealth';

export type AppointmentFilterTab = 'upcoming' | 'past' | 'cancelled';

export interface ClinicLocation {
  id: string;
  name: string;
  address: string;
  cityStateZip: string;
  phone: string;
  hours: string;
  parkingNote: string;
  accessibilityFeatures: string[];
}

export interface ClinicSamplePatient {
  label: string;
  fullName: string;
  dateOfBirth: string;
}

export interface ClinicCommonVisitReasons {
  default: string[];
  byAppointmentType?: Record<string, string[]>;
}

export interface ClinicProfile {
  id: string;
  name: string;
  shortName: string;
  specialty: string;
  phone: string;
  supportEmail: string;
  cancellationPolicyHours: number;
  bannerImage: string;
  brandAccent?: 'teal' | 'blue' | 'emerald';
  reschedulePolicy?: {
    lockProvider?: boolean;
    lockLocation?: boolean;
  };
  locations: ClinicLocation[];
  accommodations: string[];
  commonVisitReasons?: ClinicCommonVisitReasons;
  cancellationReasons?: string[];
  samplePatients?: ClinicSamplePatient[];
}

export interface ClinicBundleConfig {
  clinic: ClinicProfile;
  providers: Provider[];
  appointmentTypes: AppointmentType[];
}

export interface Provider {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  bio: string;
  languages: string[];
  locationIds: string[];
  telehealthEnabled: boolean;
  nextAvailableDate: string;
}

export interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  description: string;
  telehealthAvailable: boolean;
  preparationInstructions: string[];
}

export interface PatientProfile {
  id: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  email?: string;
  sex?: string;
  street?: string;
  city?: string;
  state?: string;
  pin?: string;
  preferredLanguage: string;
  insuranceProvider: string;
  memberId: string;
  defaultAccommodations: string[];
}

export interface PatientLookupResult {
  found: boolean;
  status: 'established' | 'new';
  patient?: PatientProfile;
  message?: string;
}

export interface PhoneVerificationSendResult {
  sent: boolean;
  phone: string;
  previewCode: string;
  expiresInSeconds: number;
}

export interface PhoneVerificationVerifyResult {
  verified: boolean;
  phone: string;
  verificationToken: string;
}

export interface TimeSlot {
  time24: string; // e.g. "09:30"
  label: string; // e.g. "9:30 AM"
  period: 'morning' | 'afternoon';
  available: boolean;
}

export interface Appointment {
  id: string;
  clinicId?: string;
  confirmationCode: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  providerId: string;
  providerName: string;
  providerCredentials: string;
  appointmentTypeId: string;
  appointmentTypeName: string;
  durationMinutes: number;
  locationId: string;
  locationName: string;
  locationAddress: string;
  visitMode: VisitMode;
  date: string; // YYYY-MM-DD
  time24: string; // HH:mm
  status: AppointmentStatus;
  reasonForVisit: string;
  accommodations: string[];
  preparationInstructions: string[];
  previousDate?: string;
  previousTime24?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingDraft {
  appointmentTypeId: string;
  visitMode: VisitMode;
  locationId: string;
  providerId: string; // 'any' or specific provider id
  date: string;
  time24: string;
  patientName: string;
  dateOfBirth: string;
  patientPhone: string;
  patientEmail?: string;
  reasonForVisit: string;
  accommodations: string[];
}

export interface ValidationErrors {
  [field: string]: string;
}
