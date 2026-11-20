import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canModifyAppointment,
  computeDropdownPlacement,
  filterInsuranceCompanies,
  filterUpcomingAppointments,
  formatDateInputDdMmYyyy,
  formatDateLabel,
  formatShortDate,
  formatTime12h,
  generateAvailableSlots,
  generateIcsContent,
  getBookableDates,
  getCommonVisitReasons,
  getProviderInitials,
  getReschedulePolicy,
  isReasonSelected,
  parseDdMmYyyyToIso,
  resolveRescheduleTargets,
  toggleVisitReason,
  validateBookingStep,
  validateCancellationReason,
  validatePatientLookup,
  validatePatientRegistration,
} from './appointments';
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

test('formatDateLabel formats ISO dates into DD-MM-YYYY format', () => {
  assert.equal(formatDateLabel('2026-11-24'), '24-11-2026');
  assert.equal(formatDateLabel('1984-05-14'), '14-05-1984');
  assert.equal(formatDateLabel('2027-01-05'), '05-01-2027');
  assert.equal(formatDateLabel(''), '');
});

test('formatShortDate returns weekday and DD-MM format', () => {
  const short = formatShortDate('2026-11-24'); // Tuesday
  assert.equal(short.weekday, 'Tue');
  assert.equal(short.monthDay, '24-11');
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

test('validateBookingStep enforces location, visit type, slot, and required reason', () => {
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

  const step1Errors = validateBookingStep(1, emptyDraft);
  assert.ok(step1Errors.appointmentTypeId);
  assert.ok(step1Errors.locationId);

  const step2Errors = validateBookingStep(2, emptyDraft);
  assert.ok(step2Errors.providerId);
  assert.ok(step2Errors.date);
  assert.ok(step2Errors.time24);
  assert.ok(step2Errors.reasonForVisit);
});

test('validateCancellationReason requires explicit reason', () => {
  const emptyErrs = validateCancellationReason('', '');
  assert.ok(emptyErrs.reason);

  const otherErrs = validateCancellationReason('Other reason', '   ');
  assert.ok(otherErrs.customNote);

  assert.deepEqual(validateCancellationReason('Schedule conflict', ''), {});
  assert.deepEqual(
    validateCancellationReason('Other reason', 'Out of town'),
    {}
  );
});

test('formatDateInputDdMmYyyy auto-formats typed digits as dd-mm-yyyy', () => {
  assert.equal(formatDateInputDdMmYyyy(''), '');
  assert.equal(formatDateInputDdMmYyyy('14'), '14');
  assert.equal(formatDateInputDdMmYyyy('1405'), '14-05');
  assert.equal(formatDateInputDdMmYyyy('14051984'), '14-05-1984');
  assert.equal(formatDateInputDdMmYyyy('12/03/1990extra'), '12-03-1990');
});

test('parseDdMmYyyyToIso validates calendar dates in DD-MM-YYYY and ISO formats', () => {
  assert.equal(parseDdMmYyyyToIso('14-05-1984'), '1984-05-14');
  assert.equal(parseDdMmYyyyToIso('29-02-2024'), '2024-02-29'); // leap year
  assert.equal(parseDdMmYyyyToIso('1984-05-14'), '1984-05-14');
  assert.equal(parseDdMmYyyyToIso('29-02-2025'), null); // non-leap year
  assert.equal(parseDdMmYyyyToIso('30-02-1990'), null);
  assert.equal(parseDdMmYyyyToIso('01-13-1990'), null);
  assert.equal(parseDdMmYyyyToIso('20/11/1980'), null);
});

test('validatePatientLookup rejects empty name and bad DOB format and accepts dd-mm-yyyy', () => {
  const errs = validatePatientLookup('', '11/20/1980');
  assert.ok(errs.fullName);
  assert.ok(errs.dateOfBirth);

  const invalidDate = validatePatientLookup('Elena Vance', '30-02-1990');
  assert.ok(invalidDate.dateOfBirth);

  const okDdMmYyyy = validatePatientLookup('Elena Vance', '14-05-1984');
  assert.deepEqual(okDdMmYyyy, {});

  const okIso = validatePatientLookup('Elena Vance', '1982-05-14');
  assert.deepEqual(okIso, {});
});

test('validatePatientRegistration enforces phone, age, sex, address, and insurance (without email)', () => {
  const errs = validatePatientRegistration({
    fullName: 'Jordan Taylor',
    dateOfBirth: '1990-03-12',
    phone: '512',
    paymentType: 'insurance',
  });
  assert.ok(errs.phone);
  assert.ok(errs.age);
  assert.ok(errs.sex);
  assert.equal(errs.email, undefined);
  assert.ok(errs.address);
  assert.ok(errs.insuranceProvider);
  assert.ok(errs.insuranceMemberId);

  const okInsurance = validatePatientRegistration({
    fullName: 'Jordan Taylor',
    dateOfBirth: '1990-03-12',
    phone: '(512) 555-0199',
    age: '30',
    sex: 'Female',
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
    fullName: 'Jordan Taylor',
    dateOfBirth: '1990-03-12',
    phone: '(512) 555-0199',
    age: '30',
    sex: 'Male',
    street: '123 Test St',
    city: 'Austin',
    state: 'TX',
    pin: '78756',
    paymentType: 'self-pay',
  });
  assert.deepEqual(okSelfPay, {});
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
