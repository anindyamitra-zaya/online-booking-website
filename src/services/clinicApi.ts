import { DEFAULT_CLINIC_SLUG, resolveClinicRoute } from '../config';
import type {
  Appointment,
  AppointmentType,
  BookingDraft,
  ClinicProfile,
  PatientLookupResult,
  PatientProfile,
  PhoneVerificationSendResult,
  PhoneVerificationVerifyResult,
  Provider,
  TimeSlot,
  VisitMode,
} from '../types/clinic';

const API_BASE = (import.meta.env.VITE_CLINIC_API_BASE_URL || '').replace(
  /\/+$/,
  ''
);

let currentSessionToken: string | null = null;
if (typeof window !== 'undefined') {
  try {
    currentSessionToken = sessionStorage.getItem('clinic-portal-session-token');
  } catch {}
}

export function setSessionToken(token: string | null) {
  currentSessionToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        sessionStorage.setItem('clinic-portal-session-token', token);
      } else {
        sessionStorage.removeItem('clinic-portal-session-token');
      }
    } catch {}
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let onSessionExpiredHandler: ((message: string) => void) | null = null;

export function setOnSessionExpiredHandler(
  handler: ((message: string) => void) | null
) {
  onSessionExpiredHandler = handler;
}

export function getSessionToken(): string | null {
  return currentSessionToken;
}

export function getActiveClinicSlug(): string {
  if (typeof window !== 'undefined') {
    const resolved = resolveClinicRoute(
      window.location.pathname,
      window.location.search,
      import.meta.env.VITE_DEFAULT_CLINIC_ID || DEFAULT_CLINIC_SLUG
    );
    return resolved.slug;
  }
  return DEFAULT_CLINIC_SLUG;
}

function getActiveClinicQuery(): string {
  const slug = getActiveClinicSlug();
  return slug ? `?clinic=${encodeURIComponent(slug)}` : '';
}

export const API_ENDPOINTS = {
  clinic: `${API_BASE}/api/clinic`,
  clinics: `${API_BASE}/api/clinics`,
  providers: `${API_BASE}/api/providers`,
  appointmentTypes: `${API_BASE}/api/appointment-types`,
  availability: `${API_BASE}/api/availability`,
  appointments: `${API_BASE}/api/appointments`,
  rescheduleAppointment: (id: string) =>
    `${API_BASE}/api/appointments/${encodeURIComponent(id)}/reschedule`,
  cancelAppointment: (id: string) =>
    `${API_BASE}/api/appointments/${encodeURIComponent(id)}/cancel`,
  patientLookup: `${API_BASE}/api/patients/lookup`,
  patientPhoneVerificationSend: `${API_BASE}/api/patients/phone-verification/send`,
  patientPhoneVerificationVerify: `${API_BASE}/api/patients/phone-verification/verify`,
  patientRegister: `${API_BASE}/api/patients/register`,
  patientById: (id: string) =>
    `${API_BASE}/api/patients/${encodeURIComponent(id)}`,
  insuranceCompanies: `${API_BASE}/api/insurance-companies`,
  recaptchaConfig: `${API_BASE}/api/security/recaptcha-config`,
  recaptchaChallenge: `${API_BASE}/api/security/recaptcha-challenge`,
  sessionKeepAlive: `${API_BASE}/api/session/keep-alive`,
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };
  const token = getSessionToken();
  if (token) {
    headers['X-Session-Token'] = token;
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      (data as { error?: string }).error ||
      `Request failed (${response.status})`;
    if (response.status === 401) {
      setSessionToken(null);
      onSessionExpiredHandler?.(errorMessage);
    }
    throw new ApiError(errorMessage, response.status);
  }
  return data as T;
}

export async function keepSessionAlive(): Promise<void> {
  try {
    await requestJson(API_ENDPOINTS.sessionKeepAlive, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch {}
}

export async function fetchClinicProfile(
  clinicSlug?: string
): Promise<ClinicProfile> {
  const qs = clinicSlug
    ? `?clinic=${encodeURIComponent(clinicSlug)}`
    : getActiveClinicQuery();
  return requestJson<ClinicProfile>(`${API_ENDPOINTS.clinic}${qs}`);
}

export async function fetchProviders(clinicSlug?: string): Promise<Provider[]> {
  const qs = clinicSlug
    ? `?clinic=${encodeURIComponent(clinicSlug)}`
    : getActiveClinicQuery();
  return requestJson<Provider[]>(`${API_ENDPOINTS.providers}${qs}`);
}

export async function fetchAppointmentTypes(
  clinicSlug?: string
): Promise<AppointmentType[]> {
  const qs = clinicSlug
    ? `?clinic=${encodeURIComponent(clinicSlug)}`
    : getActiveClinicQuery();
  return requestJson<AppointmentType[]>(`${API_ENDPOINTS.appointmentTypes}${qs}`);
}

export async function fetchPatientById(
  patientId: string
): Promise<PatientProfile> {
  return requestJson<PatientProfile>(API_ENDPOINTS.patientById(patientId));
}

export async function lookupPatient(payload: {
  firstName?: string;
  lastName?: string;
  fullName: string;
  dateOfBirth: string;
  phone?: string;
  email?: string;
  recaptchaToken: string;
}): Promise<PatientLookupResult & { sessionToken?: string }> {
  const response = await fetch(API_ENDPOINTS.patientLookup, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 404) {
    return { found: false, status: 'new' };
  }
  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error ||
        `Request failed (${response.status})`
    );
  }

  const raw = data as Partial<PatientLookupResult> &
    Partial<PatientProfile> & { sessionToken?: string };
  if (raw.sessionToken) {
    setSessionToken(raw.sessionToken);
  }

  if (typeof raw.found === 'boolean') {
    return {
      found: raw.found,
      status: raw.status || (raw.found ? 'established' : 'new'),
      patient: raw.patient,
      message: raw.message,
      sessionToken: raw.sessionToken,
    };
  }
  if (raw.id) {
    return {
      found: true,
      status: 'established',
      patient: raw as PatientProfile,
      sessionToken: raw.sessionToken,
    };
  }
  return { found: false, status: 'new', sessionToken: raw.sessionToken };
}

export async function sendPhoneVerificationCode(payload: {
  phone: string;
}): Promise<PhoneVerificationSendResult> {
  return requestJson<PhoneVerificationSendResult>(
    API_ENDPOINTS.patientPhoneVerificationSend,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function verifyPhoneVerificationCode(payload: {
  phone: string;
  code: string;
}): Promise<PhoneVerificationVerifyResult> {
  return requestJson<PhoneVerificationVerifyResult>(
    API_ENDPOINTS.patientPhoneVerificationVerify,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function registerPatient(
  payload: {
    firstName?: string;
    lastName?: string;
    fullName: string;
    dateOfBirth: string;
    phone: string;
    phoneVerificationToken: string;
    email?: string;
    sex?: string;
    street?: string;
    city?: string;
    state?: string;
    pin?: string;
    insuranceProvider?: string;
    memberId?: string;
    preferredLanguage?: string;
  }
): Promise<PatientProfile> {
  return requestJson<PatientProfile>(API_ENDPOINTS.patientRegister, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchInsuranceCompanies(
  query?: string
): Promise<string[]> {
  const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const data = await requestJson<
    string[] | { companies?: string[]; providers?: string[] }
  >(`${API_ENDPOINTS.insuranceCompanies}${qs}`);

  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.companies)) {
    return data.companies;
  }
  if (Array.isArray(data.providers)) {
    return data.providers;
  }
  return [];
}

export async function fetchAppointments(
  patientId: string,
  clinicSlug?: string
): Promise<Appointment[]> {
  const slug = clinicSlug || getActiveClinicSlug();
  const qs = new URLSearchParams({ patientId });
  if (slug) {
    qs.set('clinic', slug);
  }
  const url = `${API_ENDPOINTS.appointments}?${qs.toString()}`;
  return requestJson<Appointment[]>(url);
}

export async function fetchAvailability(params: {
  date: string;
  providerId: string;
  excludeAppointmentId?: string;
  clinicSlug?: string;
}): Promise<{ date: string; providerId: string; slots: TimeSlot[] }> {
  const slug = params.clinicSlug || getActiveClinicSlug();
  const qs = new URLSearchParams({
    date: params.date,
    providerId: params.providerId,
  });
  if (params.excludeAppointmentId) {
    qs.set('excludeAppointmentId', params.excludeAppointmentId);
  }
  if (slug) {
    qs.set('clinic', slug);
  }
  return requestJson<{ date: string; providerId: string; slots: TimeSlot[] }>(
    `${API_ENDPOINTS.availability}?${qs.toString()}`
  );
}

export async function fetchRecaptchaConfig(): Promise<{
  mode: 'google' | 'preview';
  siteKey: string | null;
}> {
  return requestJson<{ mode: 'google' | 'preview'; siteKey: string | null }>(
    API_ENDPOINTS.recaptchaConfig
  );
}

export async function createPreviewRecaptchaToken(): Promise<{
  token: string;
  expiresInSeconds: number;
}> {
  return requestJson<{ token: string; expiresInSeconds: number }>(
    API_ENDPOINTS.recaptchaChallenge,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
}

export async function createAppointment(
  patientId: string,
  clinicId: string,
  draft: BookingDraft
): Promise<Appointment> {
  return requestJson<Appointment>(API_ENDPOINTS.appointments, {
    method: 'POST',
    body: JSON.stringify({
      patientId,
      clinicId,
      ...draft,
    }),
  });
}

export async function rescheduleAppointment(
  appointmentId: string,
  clinicId: string,
  payload: {
    date: string;
    time24: string;
    providerId?: string;
    locationId?: string;
    visitMode?: VisitMode;
    reasonForVisit?: string;
  }
): Promise<Appointment> {
  return requestJson<Appointment>(
    API_ENDPOINTS.rescheduleAppointment(appointmentId),
    {
      method: 'PATCH',
      body: JSON.stringify({ clinicId, ...payload }),
    }
  );
}

export async function cancelAppointment(
  appointmentId: string,
  reason: string
): Promise<Appointment> {
  return requestJson<Appointment>(
    API_ENDPOINTS.cancelAppointment(appointmentId),
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}
