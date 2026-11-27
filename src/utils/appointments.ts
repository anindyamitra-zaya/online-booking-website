import type {
  Appointment,
  AppointmentType,
  BookingDraft,
  ClinicLocation,
  ClinicProfile,
  Provider,
  TimeSlot,
  ValidationErrors,
} from '../types/clinic';

export function formatTime12h(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  const hourNum = Number(hourStr);
  const minuteNum = Number(minuteStr);
  if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) {
    return time24;
  }
  const period = hourNum >= 12 ? 'PM' : 'AM';
  const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
  return `${hour12}:${String(minuteNum).padStart(2, '0')} ${period}`;
}

export function formatDateLabel(isoDate: string): string {
  if (!isoDate || typeof isoDate !== 'string') {
    return '';
  }
  const trimmed = isoDate.trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  const parts = trimmed.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return trimmed;
  }
  const [year, month, day] = parts;
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${year}`;
}

export function formatDateInputMmDdYyyy(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function parseMmDdYyyyToIso(input: string): string | null {
  const trimmed = (input || '').trim();
  let year: number;
  let month: number;
  let day: number;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    [year, month, day] = trimmed.split('-').map(Number);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    [month, day, year] = trimmed.split('-').map(Number);
  } else {
    return null;
  }

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatShortDate(isoDate: string): {
  weekday: string;
  monthDay: string;
} {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return { weekday: '', monthDay: isoDate };
  }
  const [year, month, day] = parts;
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return {
    weekday: new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(dt),
    monthDay: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

export function formatDateWithWeekday(isoDate: string): string {
  const raw = (isoDate || '').trim();
  if (!raw) return '';
  const normalized = parseMmDdYyyyToIso(raw) || raw;
  const parts = normalized.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return formatDateLabel(raw);
  }
  const [year, month, day] = parts;
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function formatLocationFullAddress(
  location?: { address?: string; cityStateZip?: string } | null
): string {
  if (!location) return '';
  return [location.address, location.cityStateZip]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');
}

export function toAppointmentTimestamp(dateStr: string, time24: string): number {
  return new Date(`${dateStr}T${time24}:00`).getTime();
}

export function isUpcomingAppointment(
  appointment: Appointment,
  referenceIsoDate: string
): boolean {
  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    return false;
  }
  return appointment.date >= referenceIsoDate;
}

export function canModifyAppointment(
  appointment: Appointment,
  referenceIsoDate: string
): boolean {
  return (
    (appointment.status === 'confirmed' || appointment.status === 'rescheduled') &&
    appointment.date >= referenceIsoDate
  );
}

export function filterUpcomingAppointments(
  appointments: Appointment[],
  searchQuery: string,
  referenceIsoDate: string
): Appointment[] {
  const query = searchQuery.trim().toLowerCase();

  const filtered = appointments.filter((appt) => {
    if (!isUpcomingAppointment(appt, referenceIsoDate)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      appt.appointmentTypeName,
      appt.providerName,
      appt.locationName,
      appt.confirmationCode,
      appt.reasonForVisit,
      appt.date,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  return filtered.sort((a, b) => {
    const timeA = `${a.date}T${a.time24}`;
    const timeB = `${b.date}T${b.time24}`;
    return timeA.localeCompare(timeB);
  });
}

export function getProviderInitials(name: string): string {
  const cleaned = name.replace(/^Dr\.?\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getBookableDates(startDateIso: string, daysCount = 14): string[] {
  const [year, month, day] = startDateIso.split('-').map(Number);
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // Check if start date is valid and not Sunday
  if (cursor.getUTCDay() !== 0) {
    dates.push(startDateIso);
  }

  while (dates.length < daysCount) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    // Skip Sunday (0)
    if (weekday !== 0) {
      const yyyy = cursor.getUTCFullYear();
      const mm = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(cursor.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return dates;
}

export interface CalendarMonthOption {
  year: number;
  month: number; // 1-12
  key: string; // YYYY-MM
  label: string; // e.g. November 2026
}

export interface CalendarDayCell {
  dateIso: string | null;
  dayNumber: number | null;
  inCurrentMonth: boolean;
  isSunday: boolean;
  inWindow: boolean;
}

export function formatCalendarMonthTitle(year: number, month: number): string {
  const dt = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function getAvailableMonths(
  startDateIso: string,
  daysCount = 90
): CalendarMonthOption[] {
  const bookable = getBookableDates(startDateIso, daysCount);
  const seen = new Set<string>();
  const months: CalendarMonthOption[] = [];

  for (const iso of bookable) {
    const [year, month] = iso.split('-').map(Number);
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (!seen.has(key)) {
      seen.add(key);
      months.push({
        year,
        month,
        key,
        label: formatCalendarMonthTitle(year, month),
      });
    }
  }
  return months;
}

export function getCalendarMonthGrid(
  year: number,
  month: number,
  minIso: string,
  maxIso: string
): CalendarDayCell[] {
  const firstDayDt = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const startWeekday = firstDayDt.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();

  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({
      dateIso: null,
      dayNumber: null,
      inCurrentMonth: false,
      isSunday: i === 0,
      inWindow: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const weekday = dt.getUTCDay();
    const isSunday = weekday === 0;
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const inWindow = !isSunday && dateIso >= minIso && dateIso <= maxIso;

    cells.push({
      dateIso,
      dayNumber: day,
      inCurrentMonth: true,
      isSunday,
      inWindow,
    });
  }

  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const trailing = 7 - remainder;
    for (let i = 0; i < trailing; i += 1) {
      cells.push({
        dateIso: null,
        dayNumber: null,
        inCurrentMonth: false,
        isSunday: false,
        inWindow: false,
      });
    }
  }

  return cells;
}

const CLINIC_BASE_TIMES_WEEKDAY = [
  '08:30',
  '09:00',
  '09:30',
  '10:15',
  '11:00',
  '11:30',
  '13:30',
  '14:15',
  '15:00',
  '15:45',
  '16:30',
];

const CLINIC_BASE_TIMES_SATURDAY = ['09:00', '09:45', '10:30', '11:15'];

export function generateAvailableSlots(
  dateIso: string,
  providerId: string,
  existingAppointments: Appointment[],
  excludeAppointmentId?: string
): TimeSlot[] {
  const [year, month, day] = dateIso.split('-').map(Number);
  if (!year || !month || !day) {
    return [];
  }
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = dt.getUTCDay();

  if (weekday === 0) {
    return [];
  }

  const baseTimes =
    weekday === 6 ? CLINIC_BASE_TIMES_SATURDAY : CLINIC_BASE_TIMES_WEEKDAY;

  const bookedTimes = new Set(
    existingAppointments
      .filter(
        (appt) =>
          appt.id !== excludeAppointmentId &&
          appt.status !== 'cancelled' &&
          appt.date === dateIso &&
          (providerId === 'any' || appt.providerId === providerId)
      )
      .map((appt) => appt.time24)
  );

  // Deterministic clinic schedule breaks based on date + provider hash
  const seed = `${dateIso}:${providerId}`
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const slots = baseTimes.map((time24, index) => {
    const hour = Number(time24.split(':')[0]);
    const isClinicHold = (seed + index * 3) % 7 === 0;
    const isBooked = bookedTimes.has(time24);
    return {
      time24,
      label: formatTime12h(time24),
      period: (hour < 12 ? 'morning' : 'afternoon') as 'morning' | 'afternoon',
      available: !isBooked && !isClinicHold,
    };
  });

  const available = slots.filter((s) => s.available);

  // Simulate fewer slots or fully booked (0 available slots) on 2-3 specific dates for realistic disabled date testing
  const fullyBookedDates = new Set(['2026-11-20', '2026-11-25', '2026-12-02']);
  if (fullyBookedDates.has(dateIso)) {
    return [];
  }

  return available;
}

export function validateBookingStep(
  step: number,
  draft: BookingDraft
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (step === 1) {
    if (draft.visitMode === 'in-person' && !draft.locationId) {
      errors.locationId = 'Please choose a clinic location.';
    }
  }

  if (step === 2) {
    if (!draft.appointmentTypeId) {
      errors.appointmentTypeId = 'Please select a visit type to continue.';
    }
  }

  if (step === 3) {
    if (!draft.providerId || draft.providerId === 'any') {
      errors.providerId = 'Please choose a specialist.';
    }
  }

  if (step === 4) {
    if (!draft.date) {
      errors.date = 'Please select an appointment date.';
    }
    if (!draft.time24) {
      errors.time24 = 'Please select an available time slot.';
    }
  }

  if (step === 5) {
    if (!draft.reasonForVisit.trim()) {
      errors.reasonForVisit = 'Please enter a reason for your visit.';
    }
  }

  if (step === 6) {
    if (draft.visitMode === 'in-person' && !draft.locationId) {
      errors.locationId = 'Please choose a clinic location.';
    }
    if (!draft.appointmentTypeId) {
      errors.appointmentTypeId = 'Please select a visit type to continue.';
    }
    if (!draft.providerId || draft.providerId === 'any') {
      errors.providerId = 'Please choose a specialist.';
    }
    if (!draft.date) {
      errors.date = 'Please select an appointment date.';
    }
    if (!draft.time24) {
      errors.time24 = 'Please select an available time slot.';
    }
    if (!draft.reasonForVisit.trim()) {
      errors.reasonForVisit = 'Please enter a reason for your visit.';
    }
  }

  return errors;
}

export function normalizePhoneDigits(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

export function validatePhoneNumber(phone: string): string | null {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 10) {
    return 'Please enter a valid 10-digit mobile phone number.';
  }
  return null;
}

export function validateVerificationCode(code: string): string | null {
  const cleaned = (code || '').trim();
  if (!/^\d{6}$/.test(cleaned)) {
    return 'Please enter the 6-digit verification code.';
  }
  return null;
}

export function formatResendLabel(
  secondsRemaining: number,
  sending: boolean
): string {
  if (sending) {
    return 'Sending...';
  }
  if (secondsRemaining > 0) {
    return `Resend code (${secondsRemaining}s)`;
  }
  return 'Resend code';
}

export function validateCancellationReason(
  selectedReason: string,
  customNote: string,
  confirmed = true
): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!selectedReason.trim()) {
    errors.reason = 'Please select a reason for cancelling.';
  } else if (selectedReason === 'Other reason' && !customNote.trim()) {
    errors.customNote = 'Please describe your reason for cancelling.';
  }
  if (!confirmed) {
    errors.confirmed = 'Please confirm that you want to cancel this appointment.';
  }
  return errors;
}

export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const cleaned = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return { firstName: '', lastName: '' };
  }
  const idx = cleaned.indexOf(' ');
  if (idx === -1) {
    return { firstName: cleaned, lastName: '' };
  }
  return {
    firstName: cleaned.slice(0, idx).trim(),
    lastName: cleaned.slice(idx + 1).trim(),
  };
}

export function combineFullName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' ');
}

export function calculateAgeFromDob(
  dateOfBirth: string,
  referenceIsoDate?: string
): number | null {
  const dobIso = parseMmDdYyyyToIso(dateOfBirth);
  if (!dobIso) return null;

  const [dobYear, dobMonth, dobDay] = dobIso.split('-').map(Number);

  let refYear: number;
  let refMonth: number;
  let refDay: number;
  if (referenceIsoDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceIsoDate)) {
    [refYear, refMonth, refDay] = referenceIsoDate.split('-').map(Number);
  } else {
    const now = new Date();
    refYear = now.getUTCFullYear();
    refMonth = now.getUTCMonth() + 1;
    refDay = now.getUTCDate();
  }

  let age = refYear - dobYear;
  if (refMonth < dobMonth || (refMonth === dobMonth && refDay < dobDay)) {
    age -= 1;
  }

  if (age < 0 || age > 125) {
    return null;
  }
  return age;
}

export function validatePatientLookup(
  firstNameOrFullName: string,
  lastNameOrDob: string,
  maybeDateOfBirth?: string
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (maybeDateOfBirth !== undefined) {
    if (firstNameOrFullName.trim().length < 1) {
      errors.firstName = 'Please enter your first name.';
    }
    if (lastNameOrDob.trim().length < 1) {
      errors.lastName = 'Please enter your last name.';
    }
    if (!parseMmDdYyyyToIso(maybeDateOfBirth)) {
      errors.dateOfBirth = 'Please enter a valid date of birth (MM-DD-YYYY).';
    }
    return errors;
  }

  if (firstNameOrFullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name.';
  }
  if (!parseMmDdYyyyToIso(lastNameOrDob)) {
    errors.dateOfBirth = 'Please enter a valid date of birth (MM-DD-YYYY).';
  }
  return errors;
}

export function filterInsuranceCompanies(
  companies: string[],
  query: string
): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return companies;
  }
  return companies.filter((name) =>
    name.toLowerCase().includes(normalized)
  );
}

export function computeDropdownPlacement(
  rectTop: number,
  rectBottom: number,
  viewportHeight: number,
  preferredMaxHeight = 192,
  edgeMargin = 16,
  offsetGap = 6
): { placement: 'top' | 'bottom'; maxHeight: number } {
  const spaceBelow = Math.max(
    0,
    viewportHeight - rectBottom - edgeMargin - offsetGap
  );
  const spaceAbove = Math.max(0, rectTop - edgeMargin - offsetGap);

  if (spaceBelow < preferredMaxHeight && spaceAbove > spaceBelow) {
    return {
      placement: 'top',
      maxHeight: Math.max(96, Math.min(preferredMaxHeight, Math.floor(spaceAbove))),
    };
  }

  return {
    placement: 'bottom',
    maxHeight: Math.max(96, Math.min(preferredMaxHeight, Math.floor(spaceBelow))),
  };
}

const FALLBACK_VISIT_REASONS = [
  'New symptom evaluation',
  'Follow-up visit',
  'Medication refill or review',
  'Test or lab results review',
  'Preventive checkup',
];

export function getCommonVisitReasons(
  clinic?: Pick<ClinicProfile, 'commonVisitReasons'> | null,
  appointmentTypeId?: string
): string[] {
  const configured = clinic?.commonVisitReasons;
  if (configured) {
    if (
      appointmentTypeId &&
      configured.byAppointmentType &&
      Array.isArray(configured.byAppointmentType[appointmentTypeId]) &&
      configured.byAppointmentType[appointmentTypeId].length > 0
    ) {
      return configured.byAppointmentType[appointmentTypeId];
    }
    if (Array.isArray(configured.default) && configured.default.length > 0) {
      return configured.default;
    }
  }
  return FALLBACK_VISIT_REASONS;
}

export function isReasonSelected(current: string, reason: string): boolean {
  const target = reason.trim().toLowerCase();
  if (!target || !current.trim()) return false;
  return current
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .some((part) => part === target);
}

export function toggleVisitReason(current: string, reason: string): string {
  const cleanReason = reason.trim();
  if (!cleanReason) return current;
  const parts = current
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const targetLower = cleanReason.toLowerCase();
  const exists = parts.some((part) => part.toLowerCase() === targetLower);
  if (exists) {
    return parts.filter((part) => part.toLowerCase() !== targetLower).join(', ');
  }
  return [...parts, cleanReason].join(', ');
}

export function validatePatientRegistration(payload: {
  firstName?: string;
  lastName?: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  email?: string;
  sex?: string;
  preferredLanguage?: string;
  street?: string;
  city?: string;
  state?: string;
  pin?: string;
  paymentType?: 'insurance' | 'self-pay';
  insuranceProvider?: string;
  insuranceMemberId?: string;
}): ValidationErrors {
  const errors: ValidationErrors =
    payload.firstName !== undefined || payload.lastName !== undefined
      ? validatePatientLookup(
          payload.firstName || '',
          payload.lastName || '',
          payload.dateOfBirth
        )
      : validatePatientLookup(payload.fullName, payload.dateOfBirth);

  if (!errors.dateOfBirth && calculateAgeFromDob(payload.dateOfBirth) === null) {
    errors.dateOfBirth = 'Please enter a valid date of birth (MM-DD-YYYY).';
  }

  const phoneDigits = (payload.phone || '').replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    errors.phone = 'Please enter a valid 10-digit mobile phone number.';
  }
  if (!payload.sex?.trim()) {
    errors.sex = 'Please select sex.';
  }
  if (!payload.preferredLanguage?.trim()) {
    errors.preferredLanguage = 'Please select a preferred language.';
  }
  if (
    !payload.street?.trim() ||
    !payload.city?.trim() ||
    !payload.state?.trim() ||
    !payload.pin?.trim()
  ) {
    errors.address = 'Please complete street address, city, state, and zip code.';
  }
  if (payload.paymentType === 'insurance') {
    if (!payload.insuranceProvider?.trim()) {
      errors.insuranceProvider = 'Please select or enter an insurance company.';
    }
    if (!payload.insuranceMemberId?.trim()) {
      errors.insuranceMemberId = 'Please enter your insurance member ID.';
    }
  }
  return errors;
}

export function getApplicableAppointmentTypes(
  appointmentTypes: AppointmentType[],
  patientKind?: 'new' | 'established' | null,
  locationId?: string
): AppointmentType[] {
  let filtered = appointmentTypes;
  if (patientKind) {
    const kindMatched = filtered.filter(
      (type) =>
        !type.applicablePatientKinds ||
        type.applicablePatientKinds.length === 0 ||
        type.applicablePatientKinds.includes(patientKind)
    );
    if (kindMatched.length > 0) {
      filtered = kindMatched;
    }
  }
  if (locationId) {
    const locMatched = filtered.filter(
      (type) =>
        !type.locationIds ||
        type.locationIds.length === 0 ||
        type.locationIds.includes(locationId)
    );
    if (locMatched.length > 0) {
      filtered = locMatched;
    }
  }
  return filtered;
}

export function getEligibleProviders(
  providers: Provider[],
  locationId?: string
): Provider[] {
  if (!locationId) return providers;
  const matched = providers.filter((p) => p.locationIds.includes(locationId));
  return matched.length > 0 ? matched : providers;
}

export function getVisibleBookingStepNumbers(params: {
  locationsCount: number;
  appointmentTypesCount: number;
  providersCount: number;
}): number[] {
  const steps: number[] = [];
  if (params.locationsCount > 1) steps.push(1);
  if (params.appointmentTypesCount > 1) steps.push(2);
  if (params.providersCount > 1) steps.push(3);
  steps.push(4, 5, 6);
  return steps;
}

export function resolveProviderForBooking(
  providerId: string,
  providers: Provider[],
  locationId: string,
  visitMode: 'in-person' | 'telehealth'
): Provider | undefined {
  if (providerId !== 'any') {
    return providers.find((p) => p.id === providerId);
  }
  return (
    providers.find((p) =>
      visitMode === 'telehealth'
        ? p.telehealthEnabled
        : p.locationIds.includes(locationId)
    ) || providers[0]
  );
}

export function getReschedulePolicy(
  clinic?: Pick<ClinicProfile, 'reschedulePolicy'> | null
): { lockProvider: boolean; lockLocation: boolean } {
  return {
    lockProvider: Boolean(clinic?.reschedulePolicy?.lockProvider),
    lockLocation: Boolean(clinic?.reschedulePolicy?.lockLocation),
  };
}

export function resolveRescheduleTargets(
  clinic: Pick<ClinicProfile, 'reschedulePolicy' | 'locations'> | null | undefined,
  currentAppointment: Pick<Appointment, 'providerId' | 'locationId'>,
  requested: { providerId?: string; locationId?: string }
): {
  lockProvider: boolean;
  lockLocation: boolean;
  providerId: string;
  locationId: string;
} {
  const { lockProvider, lockLocation } = getReschedulePolicy(clinic);
  const fallbackLocationId = clinic?.locations?.[0]?.id || '';
  return {
    lockProvider,
    lockLocation,
    providerId: lockProvider
      ? currentAppointment.providerId
      : requested.providerId || currentAppointment.providerId,
    locationId: lockLocation
      ? currentAppointment.locationId
      : requested.locationId ||
        (currentAppointment.locationId === 'loc-telehealth'
          ? fallbackLocationId
          : currentAppointment.locationId) ||
        fallbackLocationId,
  };
}

export function generateIcsContent(
  appointment: Appointment,
  clinic: ClinicProfile,
  location?: ClinicLocation
): string {
  const startClean = `${appointment.date.replace(/-/g, '')}T${appointment.time24.replace(':', '')}00`;
  const [hour, minute] = appointment.time24.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + appointment.durationMinutes;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  const endClean = `${appointment.date.replace(/-/g, '')}T${String(endHour).padStart(2, '0')}${String(endMinute).padStart(2, '0')}00`;

  const locationLine =
    appointment.visitMode === 'telehealth'
      ? `${clinic.name} Telehealth Video Visit`
      : location
        ? `${location.name}, ${location.address}, ${location.cityStateZip}`
        : `${appointment.locationName}, ${appointment.locationAddress}`;

  const summary = `${appointment.appointmentTypeName} with ${appointment.providerName}`;
  const description = [
    `Confirmation Code: ${appointment.confirmationCode}`,
    `Patient: ${appointment.patientName}`,
    `Visit Mode: ${appointment.visitMode === 'telehealth' ? 'Telehealth Video' : 'In-Person'}`,
    appointment.reasonForVisit ? `Notes: ${appointment.reasonForVisit}` : '',
    `Clinic Phone: ${clinic.phone}`,
  ]
    .filter(Boolean)
    .join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clinic Patient Portal//Appointment//EN',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@clinic-portal`,
    `DTSTART:${startClean}`,
    `DTEND:${endClean}`,
    `SUMMARY:${summary}`,
    `LOCATION:${locationLine}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function validateRecaptchaToken(token?: string | null): string {
  if (!token || !token.trim()) {
    return 'Please complete the Google reCAPTCHA check before confirming your appointment.';
  }
  return '';
}
