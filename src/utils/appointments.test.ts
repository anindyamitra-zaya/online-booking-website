import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAgeFromDob,
  canModifyAppointment,
  combineFullName,
  computeDropdownPlacement,
  filterInsuranceCompanies,
  filterUpcomingAppointments,
  formatCalendarMonthTitle,
  formatDateInputMmDdYyyy,
  formatDateLabel,
  formatDateWithWeekday,
  formatLocationFullAddress,
  formatResendLabel,
  formatShortDate,
  formatTime12h,
  generateAvailableSlots,
  generateIcsContent,
  getApplicableAppointmentTypes,
  getAvailableMonths,
  getBookableDates,
  getCalendarMonthGrid,
  getCommonVisitReasons,
  getEligibleProviders,
  getProviderInitials,
  getReschedulePolicy,
  getVisibleBookingStepNumbers,
  isReasonSelected,
  normalizePhoneDigits,
  parseMmDdYyyyToIso,
  resolveRescheduleTargets,
  splitFullName,
  toggleVisitReason,
  validateBookingStep,
  validateCancellationReason,
  validatePatientLookup,
  validatePatientRegistration,
  validatePhoneNumber,
  validateRecaptchaToken,
  validateVerificationCode,
} from './appointments';
import { mmcConfig } from '../config/clinics/mmc';
import { US_LANGUAGES } from '../data/usLanguages';
import { US_STATES } from '../data/usStates';
import type { Appointment, BookingDraft, ClinicProfile } from '../types/clinic';

const sampleAppointments: Appointment[] = [
  {
    id: 'apt-1',
    confirmationCode: 'TLC-4812',
    patientId: 'pat-1',
    patientName: 'Elena Vance',
    patientPhone: '(512) 555-0142',
    patientEmail: 'elena.vance@example.com',
    providerId: 'prov-1',
    providerName: 'Dr. Evelyn Reed',
    providerCredentials: 'MD, FCCP',
    appointmentTypeId: 'type-consult',
    appointmentTypeName: 'Pulmonary Follow-Up',
    durationMinutes: 30,
    locationId: 'loc-austin',
    locationName: 'North Austin Medical Plaza',
    locationAddress: '4200 Lamar Blvd, Suite 210, Austin, TX',
    visitMode: 'in-person',
    date: '2026-11-24',
    time24: '09:30',
    status: 'confirmed',
    reasonForVisit: 'Asthma inhaler review',
    accommodations: [],
    preparationInstructions: ['Bring current inhalers'],
    createdAt: '2026-11-10T12:00:00Z',
    updatedAt: '2026-11-10T12:00:00Z',
  },
  {
    id: 'apt-2',
    confirmationCode: 'TLC-4701',
    patientId: 'pat-1',
    patientName: 'Elena Vance',
    patientPhone: '(512) 555-0142',
    patientEmail: 'elena.vance@example.com',
    providerId: 'prov-2',
    providerName: 'Dr. Kenji Tanaka',
    providerCredentials: 'MD, PhD',
    appointmentTypeId: 'type-pft',
    appointmentTypeName: 'Spirometry & Lung Function',
    durationMinutes: 45,
    locationId: 'loc-austin',
    locationName: 'North Austin Medical Plaza',
    locationAddress: '4200 Lamar Blvd, Suite 210, Austin, TX',
    visitMode: 'in-person',
    date: '2026-10-14',
    time24: '14:15',
    status: 'completed',
    reasonForVisit: 'Baseline spirometry',
    accommodations: [],
    preparationInstructions: [],
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-14T15:00:00Z',
  },
  {
    id: 'apt-3',
    confirmationCode: 'TLC-4680',
    patientId: 'pat-1',
    patientName: 'Elena Vance',
    patientPhone: '(512) 555-0142',
    patientEmail: 'elena.vance@example.com',
    providerId: 'prov-3',
    providerName: 'Dr. Anita Sharma',
    providerCredentials: 'MD',
    appointmentTypeId: 'type-sleep',
    appointmentTypeName: 'Sleep Apnea Consultation',
    durationMinutes: 30,
    locationId: 'loc-telehealth',
    locationName: 'Telehealth Video Visit',
    locationAddress: 'Secure Patient Video Room',
    visitMode: 'telehealth',
    date: '2026-11-29',
    time24: '11:00',
    status: 'cancelled',
    reasonForVisit: 'CPAP pressure check',
    accommodations: [],
    preparationInstructions: [],
    cancellationReason: 'Schedule conflict',
    createdAt: '2026-11-05T12:00:00Z',
    updatedAt: '2026-11-12T12:00:00Z',
  },
];

test('formatTime12h formats 24-hour times cleanly', () => {
  assert.equal(formatTime12h('09:30'), '9:30 AM');
  assert.equal(formatTime12h('12:00'), '12:00 PM');
  assert.equal(formatTime12h('15:45'), '3:45 PM');
});

test('formatDateLabel formats ISO dates into MM-DD-YYYY format', () => {
  assert.equal(formatDateLabel('2026-11-24'), '11-24-2026');
  assert.equal(formatDateLabel('1984-05-14'), '05-14-1984');
  assert.equal(formatDateLabel('2027-01-05'), '01-05-2027');
  assert.equal(formatDateLabel(''), '');
});

test('formatShortDate returns weekday and MM-DD format', () => {
  const short = formatShortDate('2026-11-24'); // Tuesday
  assert.equal(short.weekday, 'Tue');
  assert.equal(short.monthDay, '11-24');
});

test('formatDateWithWeekday formats ISO and MM-DD-YYYY dates with full day of week and month name', () => {
  assert.equal(
    formatDateWithWeekday('2026-11-24'),
    'Tuesday, November 24, 2026'
  );
  assert.equal(
    formatDateWithWeekday('11-18-2026'),
    'Wednesday, November 18, 2026'
  );
  assert.equal(formatDateWithWeekday(''), '');
});

test('formatLocationFullAddress joins street address and city/state/zip cleanly', () => {
  assert.equal(
    formatLocationFullAddress({
      address: '2400 Medical Pkwy, Suite 300',
      cityStateZip: 'Austin, TX 78705',
    }),
    '2400 Medical Pkwy, Suite 300, Austin, TX 78705'
  );
  assert.equal(
    formatLocationFullAddress({ address: '100 Main St', cityStateZip: '' }),
    '100 Main St'
  );
  assert.equal(formatLocationFullAddress(null), '');
});

test('filterUpcomingAppointments excludes past and cancelled visits', () => {
  const upcoming = filterUpcomingAppointments(
    sampleAppointments,
    '',
    '2026-11-18'
  );
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].id, 'apt-1');

  const searchMiss = filterUpcomingAppointments(
    sampleAppointments,
    'NonexistentDoctor',
    '2026-11-18'
  );
  assert.equal(searchMiss.length, 0);
});

test('getProviderInitials extracts clinician initials cleanly', () => {
  assert.equal(getProviderInitials('Dr. Evelyn Reed'), 'ER');
  assert.equal(getProviderInitials('Dr. Kenji Tanaka'), 'KT');
});

test('canModifyAppointment allows confirmed/rescheduled future visits only', () => {
  assert.equal(canModifyAppointment(sampleAppointments[0], '2026-11-18'), true);
  assert.equal(canModifyAppointment(sampleAppointments[1], '2026-11-18'), false);
  assert.equal(canModifyAppointment(sampleAppointments[2], '2026-11-18'), false);
});

test('generateAvailableSlots returns available slots only and skips Sundays and booked times', () => {
  const sundaySlots = generateAvailableSlots('2026-11-22', 'prov-1', sampleAppointments);
  assert.equal(sundaySlots.length, 0);

  const slotsOnBookedDay = generateAvailableSlots(
    '2026-11-24',
    'prov-1',
    sampleAppointments
  );
  // Booked slot '09:30' should be filtered out entirely
  assert.equal(slotsOnBookedDay.some((s) => s.time24 === '09:30'), false);
  assert.ok(slotsOnBookedDay.every((s) => s.available));
});

test('getBookableDates skips Sundays and returns requested count', () => {
  const dates = getBookableDates('2026-11-18', 7);
  assert.equal(dates.length, 7);
  assert.ok(!dates.includes('2026-11-22')); // Sunday
});

test('1-month calendar helpers generate valid month options and aligned Sunday-Saturday grid', () => {
  assert.equal(formatCalendarMonthTitle(2026, 11), 'November 2026');
  const months = getAvailableMonths('2026-11-18', 90);
  assert.ok(months.length >= 4);
  assert.equal(months[0].key, '2026-11');
  assert.equal(months[0].label, 'November 2026');

  const grid = getCalendarMonthGrid(2026, 11, '2026-11-18', '2027-03-02');
  assert.equal(grid.length % 7, 0);
  // November 1, 2026 is a Sunday -> first cell is day 1 (Sunday)
  assert.equal(grid[0].dayNumber, 1);
  assert.equal(grid[0].isSunday, true);
  assert.equal(grid[0].inWindow, false);

  // Nov 17 is before minIso -> out of window
  const nov17 = grid.find((c) => c.dateIso === '2026-11-17');
  assert.equal(nov17?.inWindow, false);

  // Nov 18 (Wed) is in window
  const nov18 = grid.find((c) => c.dateIso === '2026-11-18');
  assert.equal(nov18?.inWindow, true);

  // Nov 22 (Sun) is Sunday -> not in window
  const nov22 = grid.find((c) => c.dateIso === '2026-11-22');
  assert.equal(nov22?.isSunday, true);
  assert.equal(nov22?.inWindow, false);
});

test('validateBookingStep enforces one question per step across all 6 steps', () => {
  const emptyDraft: BookingDraft = {
    appointmentTypeId: '',
    visitMode: 'in-person',
    locationId: '',
    providerId: '',
    date: '',
    time24: '',
    patientName: 'Elena Vance',
    dateOfBirth: '1984-05-14',
    patientPhone: '(512) 555-0142',
    patientEmail: 'elena.vance@example.com',
    reasonForVisit: '',
    accommodations: [],
  };

  // Step 1: Location
  const step1Errors = validateBookingStep(1, emptyDraft);
  assert.ok(step1Errors.locationId);
  assert.equal(step1Errors.appointmentTypeId, undefined);

  // Step 2: Visit Type
  const step2Errors = validateBookingStep(2, emptyDraft);
  assert.ok(step2Errors.appointmentTypeId);
  assert.equal(step2Errors.locationId, undefined);

  // Step 3: Specialist (requires specific specialist, not 'any')
  const step3Errors = validateBookingStep(3, emptyDraft);
  assert.ok(step3Errors.providerId);
  const step3AnyErrors = validateBookingStep(3, {
    ...emptyDraft,
    providerId: 'any',
  });
  assert.ok(step3AnyErrors.providerId);

  // Step 4: Date & Time
  const step4Errors = validateBookingStep(4, emptyDraft);
  assert.ok(step4Errors.date);
  assert.ok(step4Errors.time24);

  // Step 5: Reason for Visit
  const step5Errors = validateBookingStep(5, emptyDraft);
  assert.ok(step5Errors.reasonForVisit);

  // Step 6: Review & Confirm checks all fields
  const step6Errors = validateBookingStep(6, emptyDraft);
  assert.ok(step6Errors.locationId);
  assert.ok(step6Errors.appointmentTypeId);
  assert.ok(step6Errors.providerId);
  assert.ok(step6Errors.date);
  assert.ok(step6Errors.time24);
  assert.ok(step6Errors.reasonForVisit);
});

test('phone verification helpers normalize US numbers and validate phone & 6-digit OTP', () => {
  assert.equal(normalizePhoneDigits('(512) 555-0199'), '5125550199');
  assert.equal(normalizePhoneDigits('+1 (512) 555-0199'), '5125550199');

  assert.ok(validatePhoneNumber('512555'));
  assert.equal(validatePhoneNumber('(512) 555-0199'), null);

  assert.ok(validateVerificationCode('12345'));
  assert.ok(validateVerificationCode('12ab56'));
  assert.equal(validateVerificationCode('482910'), null);

  assert.equal(formatResendLabel(60, false), 'Resend code (60s)');
  assert.equal(formatResendLabel(1, false), 'Resend code (1s)');
  assert.equal(formatResendLabel(0, false), 'Resend code');
  assert.equal(formatResendLabel(30, true), 'Sending...');
});

test('validateCancellationReason requires explicit reason and confirmation checkbox', () => {
  const emptyErrs = validateCancellationReason('', '');
  assert.ok(emptyErrs.reason);

  const otherErrs = validateCancellationReason('Other reason', '   ');
  assert.ok(otherErrs.customNote);

  const unconfirmedErrs = validateCancellationReason('Schedule conflict', '', false);
  assert.ok(unconfirmedErrs.confirmed);

  assert.deepEqual(validateCancellationReason('Schedule conflict', '', true), {});
  assert.deepEqual(
    validateCancellationReason('Other reason', 'Out of town', true),
    {}
  );
});

test('formatDateInputMmDdYyyy auto-formats typed digits as mm-dd-yyyy', () => {
  assert.equal(formatDateInputMmDdYyyy(''), '');
  assert.equal(formatDateInputMmDdYyyy('05'), '05');
  assert.equal(formatDateInputMmDdYyyy('0514'), '05-14');
  assert.equal(formatDateInputMmDdYyyy('05141984'), '05-14-1984');
  assert.equal(formatDateInputMmDdYyyy('03/12/1990extra'), '03-12-1990');
});

test('parseMmDdYyyyToIso validates calendar dates in MM-DD-YYYY and ISO formats', () => {
  assert.equal(parseMmDdYyyyToIso('05-14-1984'), '1984-05-14');
  assert.equal(parseMmDdYyyyToIso('02-29-2024'), '2024-02-29'); // leap year
  assert.equal(parseMmDdYyyyToIso('1984-05-14'), '1984-05-14');
  assert.equal(parseMmDdYyyyToIso('02-29-2025'), null); // non-leap year
  assert.equal(parseMmDdYyyyToIso('02-30-1990'), null);
  assert.equal(parseMmDdYyyyToIso('13-01-1990'), null);
  assert.equal(parseMmDdYyyyToIso('11/20/1980'), null);
});

test('splitFullName, combineFullName, and calculateAgeFromDob compute expected values', () => {
  assert.deepEqual(splitFullName('Elena Vance'), {
    firstName: 'Elena',
    lastName: 'Vance',
  });
  assert.deepEqual(splitFullName('Mary Jane Watson'), {
    firstName: 'Mary',
    lastName: 'Jane Watson',
  });
  assert.equal(combineFullName('Elena', 'Vance'), 'Elena Vance');

  assert.equal(calculateAgeFromDob('1984-05-14', '2026-11-18'), 42);
  assert.equal(calculateAgeFromDob('05-14-1984', '2026-05-13'), 41);
  assert.equal(calculateAgeFromDob('05-14-1984', '2026-05-14'), 42);
  assert.equal(calculateAgeFromDob('invalid', '2026-11-18'), null);
});

test('validatePatientLookup rejects empty first/last name and bad DOB format and accepts mm-dd-yyyy', () => {
  const splitErrs = validatePatientLookup('', '', '11/20/1980');
  assert.ok(splitErrs.firstName);
  assert.ok(splitErrs.lastName);
  assert.ok(splitErrs.dateOfBirth);

  const okSplit = validatePatientLookup('Elena', 'Vance', '05-14-1984');
  assert.deepEqual(okSplit, {});

  const errs = validatePatientLookup('', '11/20/1980');
  assert.ok(errs.fullName);
  assert.ok(errs.dateOfBirth);

  const invalidDate = validatePatientLookup('Elena Vance', '02-30-1990');
  assert.ok(invalidDate.dateOfBirth);

  const okMmDdYyyy = validatePatientLookup('Elena Vance', '05-14-1984');
  assert.deepEqual(okMmDdYyyy, {});

  const okIso = validatePatientLookup('Elena Vance', '1982-05-14');
  assert.deepEqual(okIso, {});
});

test('validatePatientRegistration enforces phone, sex, preferredLanguage, address, and insurance without manual age field', () => {
  const errs = validatePatientRegistration({
    firstName: 'Jordan',
    lastName: 'Taylor',
    fullName: 'Jordan Taylor',
    dateOfBirth: '1990-03-12',
    phone: '512',
    paymentType: 'insurance',
  });
  assert.ok(errs.phone);
  assert.equal(errs.age, undefined);
  assert.ok(errs.sex);
  assert.ok(errs.preferredLanguage);
  assert.equal(errs.email, undefined);
  assert.ok(errs.address);
  assert.ok(errs.insuranceProvider);
  assert.ok(errs.insuranceMemberId);

  const okInsurance = validatePatientRegistration({
    firstName: 'Jordan',
    lastName: 'Taylor',
    fullName: 'Jordan Taylor',
    dateOfBirth: '1990-03-12',
    phone: '(512) 555-0199',
    sex: 'Female',
    preferredLanguage: 'English',
    street: '123 Test St',
    city: 'Austin',
    state: 'TX',
    pin: '78756',
    paymentType: 'insurance',
    insuranceProvider: 'Cigna Healthcare',
    insuranceMemberId: 'CIG-112233',
  });
  assert.deepEqual(okInsurance, {});

  const okSelfPay = validatePatientRegistration({
    firstName: 'Jordan',
    lastName: 'Taylor',
    fullName: 'Jordan Taylor',
    dateOfBirth: '1990-03-12',
    phone: '(512) 555-0199',
    sex: 'Male',
    preferredLanguage: 'Spanish',
    street: '123 Test St',
    city: 'Austin',
    state: 'TX',
    pin: '78756',
    paymentType: 'self-pay',
  });
  assert.deepEqual(okSelfPay, {});
});

test('single-option booking steps are skipped automatically while multi-option steps remain', () => {
  const newTypes = getApplicableAppointmentTypes(
    mmcConfig.appointmentTypes,
    'new',
    mmcConfig.clinic.locations[0].id
  );
  assert.equal(newTypes.length, 1);
  assert.equal(newTypes[0].id, 'type-mmc-new-consult');

  const establishedTypes = getApplicableAppointmentTypes(
    mmcConfig.appointmentTypes,
    'established',
    mmcConfig.clinic.locations[0].id
  );
  assert.equal(establishedTypes.length, 2);

  const eligibleProvs = getEligibleProviders(
    mmcConfig.providers,
    mmcConfig.clinic.locations[0].id
  );
  assert.equal(eligibleProvs.length, 1);

  assert.deepEqual(
    getVisibleBookingStepNumbers({
      locationsCount: mmcConfig.clinic.locations.length,
      appointmentTypesCount: newTypes.length,
      providersCount: eligibleProvs.length,
    }),
    [4, 5, 6]
  );

  assert.deepEqual(
    getVisibleBookingStepNumbers({
      locationsCount: mmcConfig.clinic.locations.length,
      appointmentTypesCount: establishedTypes.length,
      providersCount: eligibleProvs.length,
    }),
    [2, 4, 5, 6]
  );

  assert.deepEqual(
    getVisibleBookingStepNumbers({
      locationsCount: 2,
      appointmentTypesCount: 5,
      providersCount: 3,
    }),
    [1, 2, 3, 4, 5, 6]
  );
});

test('filterInsuranceCompanies filters matching company names case-insensitively', () => {
  const sample = ['Aetna', 'BlueCross BlueShield', 'Cigna Healthcare', 'UnitedHealthcare'];
  assert.deepEqual(filterInsuranceCompanies(sample, ''), sample);
  assert.deepEqual(filterInsuranceCompanies(sample, 'blue'), ['BlueCross BlueShield']);
  assert.deepEqual(filterInsuranceCompanies(sample, 'CIG'), ['Cigna Healthcare']);
  assert.deepEqual(filterInsuranceCompanies(sample, 'health'), [
    'Cigna Healthcare',
    'UnitedHealthcare',
  ]);
});

test('US_STATES includes all 50 states plus DC with 2-letter codes', () => {
  assert.equal(US_STATES.length, 51);
  assert.ok(US_STATES.every((s) => /^[A-Z]{2}$/.test(s.code) && s.name.length > 0));
  assert.ok(US_STATES.some((s) => s.code === 'TX' && s.name === 'Texas'));
  assert.ok(US_STATES.some((s) => s.code === 'DC' && s.name === 'District of Columbia'));
});

test('US_LANGUAGES includes common US spoken languages', () => {
  assert.ok(US_LANGUAGES.includes('English'));
  assert.ok(US_LANGUAGES.includes('Spanish'));
  assert.ok(US_LANGUAGES.includes('Tagalog (Filipino)'));
  assert.ok(US_LANGUAGES.includes('American Sign Language (ASL)'));
  assert.ok(US_LANGUAGES.length >= 15);
});

test('getCommonVisitReasons returns clinic-config and visit-type specific options', () => {
  const customClinic = {
    commonVisitReasons: {
      default: ['Asthma / inhaler review', 'Shortness of breath'],
      byAppointmentType: {
        'type-sleep': ['CPAP pressure or mask review'],
      },
    },
  };
  assert.deepEqual(getCommonVisitReasons(customClinic), [
    'Asthma / inhaler review',
    'Shortness of breath',
  ]);
  assert.deepEqual(getCommonVisitReasons(customClinic, 'type-sleep'), [
    'CPAP pressure or mask review',
  ]);
  assert.deepEqual(getCommonVisitReasons(customClinic, 'type-other'), [
    'Asthma / inhaler review',
    'Shortness of breath',
  ]);
  assert.ok(getCommonVisitReasons(null).length > 0);
});

test('toggleVisitReason adds and removes comma-separated reasons cleanly', () => {
  assert.equal(toggleVisitReason('', 'Shortness of breath'), 'Shortness of breath');
  assert.equal(
    toggleVisitReason('Shortness of breath', 'Medication refill'),
    'Shortness of breath, Medication refill'
  );
  assert.equal(
    toggleVisitReason('Shortness of breath, Medication refill', 'shortness of breath'),
    'Medication refill'
  );
  assert.equal(
    isReasonSelected('Shortness of breath, Medication refill', 'Medication refill'),
    true
  );
  assert.equal(
    isReasonSelected('Shortness of breath, Medication refill', 'Chronic cough'),
    false
  );
});

test('computeDropdownPlacement flips upward near screen bottom and preserves edge margin', () => {
  // Near bottom of 900px viewport: should flip upward
  assert.deepEqual(computeDropdownPlacement(770, 810, 900, 192, 16), {
    placement: 'top',
    maxHeight: 192,
  });

  // Plenty of space below: opens downward with full height
  assert.deepEqual(computeDropdownPlacement(300, 340, 900, 192, 16), {
    placement: 'bottom',
    maxHeight: 192,
  });

  // Moderately constrained below and even tighter above: caps height preserving 16px margin + 6px gap
  assert.deepEqual(computeDropdownPlacement(100, 140, 296, 192, 16), {
    placement: 'bottom',
    maxHeight: 134,
  });
});

test('generateIcsContent produces valid VCALENDAR payload', () => {
  const clinic: ClinicProfile = {
    id: 'texas-lung',
    name: 'Texas Lung & Specialty Care',
    shortName: 'Texas Lung Care',
    specialty: 'Pulmonology & Sleep Medicine',
    phone: '(512) 555-0190',
    supportEmail: 'care@texaslungportal.example',
    cancellationPolicyHours: 24,
    bannerImage: '/img.jpg',
    locations: [],
    accommodations: [],
  };

  const ics = generateIcsContent(sampleAppointments[0], clinic);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:Pulmonary Follow-Up with Dr. Evelyn Reed'));
  assert.ok(ics.includes('DTSTART:20261124T093000'));
  assert.ok(ics.includes('DTEND:20261124T100000'));
});

test('getReschedulePolicy and resolveRescheduleTargets enforce provider and location locks', () => {
  const current = { providerId: 'prov-1', locationId: 'loc-1' };
  const requested = { providerId: 'prov-2', locationId: 'loc-2' };

  assert.deepEqual(
    getReschedulePolicy({ reschedulePolicy: { lockProvider: true, lockLocation: false } }),
    { lockProvider: true, lockLocation: false }
  );

  // Unlocked clinic allows changing both
  assert.deepEqual(
    resolveRescheduleTargets(
      { reschedulePolicy: { lockProvider: false, lockLocation: false }, locations: [] },
      current,
      requested
    ),
    {
      lockProvider: false,
      lockLocation: false,
      providerId: 'prov-2',
      locationId: 'loc-2',
    }
  );

  // Provider-locked clinic keeps original provider while allowing location change
  assert.deepEqual(
    resolveRescheduleTargets(
      { reschedulePolicy: { lockProvider: true, lockLocation: false }, locations: [] },
      current,
      requested
    ),
    {
      lockProvider: true,
      lockLocation: false,
      providerId: 'prov-1',
      locationId: 'loc-2',
    }
  );

  // Both locked clinic keeps both original provider and location
  assert.deepEqual(
    resolveRescheduleTargets(
      { reschedulePolicy: { lockProvider: true, lockLocation: true }, locations: [] },
      current,
      requested
    ),
    {
      lockProvider: true,
      lockLocation: true,
      providerId: 'prov-1',
      locationId: 'loc-1',
    }
  );
});

test('validateRecaptchaToken requires non-empty verification token', () => {
  assert.ok(validateRecaptchaToken('') !== '');
  assert.ok(validateRecaptchaToken('   ') !== '');
  assert.ok(validateRecaptchaToken(null) !== '');
  assert.equal(validateRecaptchaToken('valid-token-123'), '');
});
