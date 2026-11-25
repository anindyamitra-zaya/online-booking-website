import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { listConfiguredClinics } from './src/config';
import {
  CLINIC_BUNDLES,
  DEFAULT_APPOINTMENTS,
  DEFAULT_CLINIC_BUNDLE,
  DEFAULT_PATIENTS,
  REFERENCE_TODAY_ISO,
  type ClinicBundle,
} from './src/data/seedClinicData';
import type { Appointment, PatientProfile } from './src/types/clinic';
import { DEFAULT_INSURANCE_COMPANIES } from './src/data/insuranceCompanies';
import {
  filterInsuranceCompanies,
  filterUpcomingAppointments,
  generateAvailableSlots,
  normalizePhoneDigits,
  parseMmDdYyyyToIso,
  resolveProviderForBooking,
  validatePhoneNumber,
  validateVerificationCode,
} from './src/utils/appointments';

interface PhoneVerificationChallenge {
  phoneDigits: string;
  phoneDisplay: string;
  code: string;
  expiresAt: number;
  verified: boolean;
  verificationToken?: string;
}

const phoneChallenges = new Map<string, PhoneVerificationChallenge>();

const RECAPTCHA_SITE_KEY = (
  process.env.VITE_RECAPTCHA_SITE_KEY ||
  process.env.RECAPTCHA_SITE_KEY ||
  ''
).trim();
const RECAPTCHA_SECRET_KEY = (process.env.RECAPTCHA_SECRET_KEY || '').trim();
const HAS_GOOGLE_RECAPTCHA = Boolean(RECAPTCHA_SITE_KEY && RECAPTCHA_SECRET_KEY);
const PREVIEW_RECAPTCHA_SECRET = crypto.randomBytes(32);
const usedPreviewNonces = new Map<string, number>();

function issuePreviewRecaptchaToken(): { token: string; expiresInSeconds: number } {
  const expiresInSeconds = 600;
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Date.now() + expiresInSeconds * 1000;
  const payload = `${nonce}.${exp}`;
  const sig = crypto
    .createHmac('sha256', PREVIEW_RECAPTCHA_SECRET)
    .update(payload)
    .digest('hex');
  return { token: `${payload}.${sig}`, expiresInSeconds };
}

function verifyPreviewRecaptchaToken(token: string): { ok: boolean; error?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'Invalid verification token. Please verify again.' };
  }
  const [nonce, expRaw, sigHex] = parts;
  const exp = Number(expRaw);
  if (!nonce || !Number.isFinite(exp) || Date.now() > exp) {
    return { ok: false, error: 'Verification expired. Please check the box again.' };
  }

  const now = Date.now();
  for (const [k, v] of usedPreviewNonces.entries()) {
    if (v < now) usedPreviewNonces.delete(k);
  }
  if (usedPreviewNonces.has(nonce)) {
    return { ok: false, error: 'Verification token already used. Please check the box again.' };
  }

  const expectedHex = crypto
    .createHmac('sha256', PREVIEW_RECAPTCHA_SECRET)
    .update(`${nonce}.${expRaw}`)
    .digest('hex');
  const sigBuf = Buffer.from(sigHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { ok: false, error: 'Invalid verification signature. Please verify again.' };
  }

  usedPreviewNonces.set(nonce, exp);
  return { ok: true };
}

async function verifyRecaptchaToken(
  token: string,
  remoteIp?: string
): Promise<{ ok: boolean; error?: string }> {
  const clean = token.trim();
  if (!clean) {
    return {
      ok: false,
      error: 'Please complete the reCAPTCHA check before confirming your appointment.',
    };
  }

  if (!HAS_GOOGLE_RECAPTCHA) {
    return verifyPreviewRecaptchaToken(clean);
  }

  try {
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: clean,
    });
    if (remoteIp) {
      params.set('remoteip', remoteIp);
    }
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!resp.ok) {
      return {
        ok: false,
        error: 'Unable to verify Google reCAPTCHA right now. Please try again.',
      };
    }
    const data = (await resp.json()) as { success?: boolean };
    if (!data.success) {
      return {
        ok: false,
        error: 'Google reCAPTCHA verification failed. Please complete the check again.',
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Unable to reach Google reCAPTCHA verification service. Please try again.',
    };
  }
}

interface StoreState {
  patients: PatientProfile[];
  appointments: Appointment[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'clinic-store.json');

function resolveClinicBundle(clinicParam?: string): ClinicBundle {
  const key = (clinicParam || process.env.CLINIC_ID || 'texas-lung')
    .trim()
    .toLowerCase();
  return CLINIC_BUNDLES[key] || DEFAULT_CLINIC_BUNDLE;
}

function loadStore(): StoreState {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoreState>;
      if (
        parsed &&
        Array.isArray(parsed.appointments) &&
        Array.isArray(parsed.patients)
      ) {
        const hydratedPatients = parsed.patients.map((p) => {
          const seedMatch = DEFAULT_PATIENTS.find((sp) => sp.id === p.id);
          if (!seedMatch) return p;
          return {
            ...seedMatch,
            ...p,
            sex: p.sex || seedMatch.sex,
            street: p.street || seedMatch.street,
            city: p.city || seedMatch.city,
            state: p.state || seedMatch.state,
            pin: p.pin || seedMatch.pin,
          };
        });
        return {
          patients: hydratedPatients,
          appointments: parsed.appointments,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load clinic store, initializing defaults:', err);
  }

  const initial: StoreState = {
    patients: DEFAULT_PATIENTS,
    appointments: DEFAULT_APPOINTMENTS,
  };
  saveStore(initial);
  return initial;
}

function saveStore(state: StoreState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist clinic store:', err);
  }
}

function createConfirmationCode(clinicShortName: string): string {
  const prefix = clinicShortName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix || 'CLN'}-${digits}`;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json());

  const store = loadStore();

  app.get('/api/health', (req, res) => {
    const bundle = resolveClinicBundle(req.query.clinic as string | undefined);
    res.json({ status: 'ok', clinicId: bundle.clinic.id });
  });

  app.get('/api/security/recaptcha-config', (_req, res) => {
    res.json({
      mode: HAS_GOOGLE_RECAPTCHA ? 'google' : 'preview',
      siteKey: HAS_GOOGLE_RECAPTCHA ? RECAPTCHA_SITE_KEY : null,
    });
  });

  app.post('/api/security/recaptcha-challenge', (_req, res) => {
    if (HAS_GOOGLE_RECAPTCHA) {
      res.status(400).json({
        error: 'Live Google reCAPTCHA is enabled; use the Google reCAPTCHA widget.',
      });
      return;
    }
    res.json(issuePreviewRecaptchaToken());
  });

  app.get('/api/clinics', (_req, res) => {
    res.json(listConfiguredClinics());
  });

  app.get('/api/clinic', (req, res) => {
    const bundle = resolveClinicBundle(req.query.clinic as string | undefined);
    res.json(bundle.clinic);
  });

  app.get('/api/providers', (req, res) => {
    const bundle = resolveClinicBundle(req.query.clinic as string | undefined);
    res.json(bundle.providers);
  });

  app.get('/api/appointment-types', (req, res) => {
    const bundle = resolveClinicBundle(req.query.clinic as string | undefined);
    res.json(bundle.appointmentTypes);
  });

  app.get('/api/insurance-companies', (req, res) => {
    const query = String(req.query.q || '');
    const companies = filterInsuranceCompanies(
      DEFAULT_INSURANCE_COMPANIES,
      query
    );
    res.json({ companies });
  });

  app.get('/api/availability', (req, res) => {
    const bundle = resolveClinicBundle(req.query.clinic as string | undefined);
    const date = String(req.query.date || '');
    const providerId = String(req.query.providerId || 'any');
    const excludeAppointmentId = req.query.excludeAppointmentId
      ? String(req.query.excludeAppointmentId)
      : undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Valid YYYY-MM-DD date is required.' });
      return;
    }

    const clinicAppts = store.appointments.filter(
      (a) => !a.clinicId || a.clinicId === bundle.clinic.id
    );

    const slots = generateAvailableSlots(
      date,
      providerId,
      clinicAppts,
      excludeAppointmentId
    );
    res.json({ date, providerId, slots });
  });

  app.post('/api/patients/lookup', (req, res) => {
    const fullName = String(req.body?.fullName || '').trim();
    const rawDob = String(req.body?.dateOfBirth || '').trim();
    const dateOfBirth = parseMmDdYyyyToIso(rawDob) || rawDob;
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim();

    if (!fullName || !dateOfBirth) {
      res.status(400).json({
        error: 'Both full name and date of birth are required.',
      });
      return;
    }

    const existing = store.patients.find(
      (p) =>
        p.fullName.toLowerCase() === fullName.toLowerCase() &&
        p.dateOfBirth === dateOfBirth
    );

    if (existing) {
      if (phone) existing.phone = phone;
      if (email) existing.email = email;
      saveStore(store);
      res.json({
        found: true,
        status: 'established',
        patient: existing,
      });
      return;
    }

    res.json({
      found: false,
      status: 'new',
      message:
        'No existing patient record found. Please verify your phone number to continue registration.',
    });
  });

  app.post('/api/patients/phone-verification/send', (req, res) => {
    const rawPhone = String(req.body?.phone || '').trim();
    const phoneErr = validatePhoneNumber(rawPhone);
    if (phoneErr) {
      res.status(400).json({ error: phoneErr });
      return;
    }

    const phoneDigits = normalizePhoneDigits(rawPhone);
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresInSeconds = 300;
    phoneChallenges.set(phoneDigits, {
      phoneDigits,
      phoneDisplay: rawPhone,
      code,
      expiresAt: Date.now() + expiresInSeconds * 1000,
      verified: false,
    });

    res.json({
      sent: true,
      phone: rawPhone,
      previewCode: code,
      expiresInSeconds,
    });
  });

  app.post('/api/patients/phone-verification/verify', (req, res) => {
    const rawPhone = String(req.body?.phone || '').trim();
    const code = String(req.body?.code || '').trim();
    const phoneErr = validatePhoneNumber(rawPhone);
    if (phoneErr) {
      res.status(400).json({ error: phoneErr });
      return;
    }
    const codeErr = validateVerificationCode(code);
    if (codeErr) {
      res.status(400).json({ error: codeErr });
      return;
    }

    const phoneDigits = normalizePhoneDigits(rawPhone);
    const challenge = phoneChallenges.get(phoneDigits);
    if (!challenge || challenge.expiresAt < Date.now()) {
      res.status(400).json({
        error: 'Verification code expired. Please request a new code.',
      });
      return;
    }

    if (challenge.code !== code) {
      res.status(400).json({
        error: 'Invalid verification code. Please check the code and try again.',
      });
      return;
    }

    const verificationToken = crypto.randomBytes(24).toString('hex');
    challenge.verified = true;
    challenge.verificationToken = verificationToken;
    phoneChallenges.set(phoneDigits, challenge);

    res.json({
      verified: true,
      phone: challenge.phoneDisplay || rawPhone,
      verificationToken,
    });
  });

  app.post('/api/patients/register', (req, res) => {
    const fullName = String(req.body?.fullName || '').trim();
    const rawDob = String(req.body?.dateOfBirth || '').trim();
    const dateOfBirth = parseMmDdYyyyToIso(rawDob) || rawDob;
    const phone = String(req.body?.phone || '').trim();
    const phoneVerificationToken = String(
      req.body?.phoneVerificationToken || ''
    ).trim();
    const email = String(req.body?.email || '').trim();
    const sex = String(req.body?.sex || '').trim();
    const street = String(req.body?.street || '').trim();
    const city = String(req.body?.city || '').trim();
    const state = String(req.body?.state || '').trim();
    const pin = String(req.body?.pin || '').trim();
    const insuranceProvider = String(
      req.body?.insuranceProvider || ''
    ).trim();
    const memberId = String(req.body?.memberId || '').trim();
    const preferredLanguage = String(
      req.body?.preferredLanguage || 'English'
    ).trim();

    if (!fullName || !dateOfBirth || !phone) {
      res.status(400).json({
        error:
          'Full name, date of birth, and mobile phone number are required to register.',
      });
      return;
    }

    const phoneDigits = normalizePhoneDigits(phone);
    const challenge = phoneChallenges.get(phoneDigits);
    if (
      !challenge ||
      !challenge.verified ||
      !phoneVerificationToken ||
      challenge.verificationToken !== phoneVerificationToken
    ) {
      res.status(403).json({
        error:
          'Please verify your mobile phone number before completing patient registration.',
      });
      return;
    }

    const existing = store.patients.find(
      (p) =>
        p.fullName.toLowerCase() === fullName.toLowerCase() &&
        p.dateOfBirth === dateOfBirth
    );
    if (existing) {
      if (sex) existing.sex = sex;
      if (preferredLanguage) existing.preferredLanguage = preferredLanguage;
      if (street) existing.street = street;
      if (city) existing.city = city;
      if (state) existing.state = state;
      if (pin) existing.pin = pin;
      phoneChallenges.delete(phoneDigits);
      saveStore(store);
      res.json(existing);
      return;
    }

    const newPatient: PatientProfile = {
      id: `pat-${Date.now()}`,
      fullName,
      dateOfBirth,
      phone,
      email,
      sex: sex || undefined,
      street: street || undefined,
      city: city || undefined,
      state: state || undefined,
      pin: pin || undefined,
      preferredLanguage: preferredLanguage || 'English',
      insuranceProvider: insuranceProvider || 'Self-Pay / To Be Verified',
      memberId: memberId || `PT-${Math.floor(100000 + Math.random() * 900000)}`,
      defaultAccommodations: [],
    };
    store.patients.push(newPatient);
    phoneChallenges.delete(phoneDigits);
    saveStore(store);
    res.status(201).json(newPatient);
  });

  app.get('/api/patients/:patientId', (req, res) => {
    const patient = store.patients.find((p) => p.id === req.params.patientId);
    if (!patient) {
      res.status(404).json({ error: 'Patient record not found.' });
      return;
    }
    res.json(patient);
  });

  // Only returns upcoming active appointments for the verified patient & active clinic
  app.get('/api/appointments', (req, res) => {
    const patientId = String(req.query.patientId || '');
    if (!patientId) {
      res.status(400).json({ error: 'patientId is required.' });
      return;
    }
    const bundle = resolveClinicBundle(req.query.clinic as string | undefined);
    const patientAppointments = store.appointments.filter(
      (a) =>
        a.patientId === patientId &&
        (!a.clinicId || a.clinicId === bundle.clinic.id)
    );
    const upcomingOnly = filterUpcomingAppointments(
      patientAppointments,
      '',
      REFERENCE_TODAY_ISO
    );
    res.json(upcomingOnly);
  });

  app.post('/api/appointments', async (req, res) => {
    const bundle = resolveClinicBundle(
      (req.body?.clinicId as string | undefined) ||
        (req.query.clinic as string | undefined)
    );
    const {
      patientId,
      appointmentTypeId,
      visitMode = 'in-person',
      locationId,
      providerId = 'any',
      date,
      time24,
      patientName,
      patientPhone,
      patientEmail,
      reasonForVisit = '',
      accommodations = [],
      recaptchaToken = '',
    } = req.body || {};

    const recaptchaCheck = await verifyRecaptchaToken(
      String(recaptchaToken || ''),
      req.ip
    );
    if (!recaptchaCheck.ok) {
      res.status(recaptchaToken ? 403 : 400).json({
        error:
          recaptchaCheck.error ||
          'Please complete the reCAPTCHA verification before confirming.',
      });
      return;
    }

    if (
      !patientId ||
      !appointmentTypeId ||
      !date ||
      !time24 ||
      !patientName ||
      !String(reasonForVisit || '').trim()
    ) {
      res.status(400).json({
        error:
          'Missing required booking fields (patient, visit type, date, time, name, or reason for visit).',
      });
      return;
    }

    const registeredPatient = store.patients.find((p) => p.id === patientId);
    if (!registeredPatient) {
      res.status(400).json({
        error:
          'Patient details must be verified or registered before booking an appointment.',
      });
      return;
    }

    const visitType = bundle.appointmentTypes.find(
      (t) => t.id === appointmentTypeId
    );
    if (!visitType) {
      res.status(400).json({ error: 'Selected appointment type was not found.' });
      return;
    }

    const resolvedProvider = resolveProviderForBooking(
      providerId,
      bundle.providers,
      locationId,
      visitMode
    );
    if (!resolvedProvider) {
      res.status(400).json({ error: 'No matching specialist is available.' });
      return;
    }

    const slots = generateAvailableSlots(
      date,
      resolvedProvider.id,
      store.appointments
    );
    const matchedSlot = slots.find((s) => s.time24 === time24);
    if (!matchedSlot || !matchedSlot.available) {
      res.status(409).json({
        error:
          'That time slot is no longer available. Please choose another open time.',
      });
      return;
    }

    const location = bundle.clinic.locations.find((l) => l.id === locationId);
    const nowIso = new Date().toISOString();

    const created: Appointment = {
      id: `apt-${Date.now()}`,
      clinicId: bundle.clinic.id,
      confirmationCode: createConfirmationCode(bundle.clinic.shortName),
      patientId,
      patientName: String(patientName).trim(),
      patientPhone: String(patientPhone || '').trim(),
      patientEmail: String(patientEmail || '').trim(),
      providerId: resolvedProvider.id,
      providerName: resolvedProvider.name,
      providerCredentials: resolvedProvider.credentials,
      appointmentTypeId: visitType.id,
      appointmentTypeName: visitType.name,
      durationMinutes: visitType.durationMinutes,
      locationId:
        visitMode === 'telehealth'
          ? 'loc-telehealth'
          : location?.id || bundle.clinic.locations[0]?.id || 'loc-main',
      locationName:
        visitMode === 'telehealth'
          ? 'Telehealth Video Visit'
          : location?.name || bundle.clinic.locations[0]?.name || bundle.clinic.name,
      locationAddress:
        visitMode === 'telehealth'
          ? 'Encrypted Patient Video Room (link sent 30 min prior)'
          : location
            ? `${location.address}, ${location.cityStateZip}`
            : '',
      visitMode,
      date,
      time24,
      status: 'confirmed',
      reasonForVisit: String(reasonForVisit).trim(),
      accommodations: Array.isArray(accommodations) ? accommodations : [],
      preparationInstructions: visitType.preparationInstructions,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.appointments.unshift(created);
    saveStore(store);
    res.status(201).json(created);
  });

  app.patch('/api/appointments/:id/reschedule', (req, res) => {
    const bundle = resolveClinicBundle(
      (req.body?.clinicId as string | undefined) ||
        (req.query.clinic as string | undefined)
    );
    const apptIndex = store.appointments.findIndex(
      (a) => a.id === req.params.id
    );
    if (apptIndex === -1) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const current = store.appointments[apptIndex];
    if (current.status === 'cancelled' || current.status === 'completed') {
      res.status(400).json({
        error: 'Cancelled or completed appointments cannot be rescheduled.',
      });
      return;
    }

    const newDate = String(req.body?.date || '');
    const newTime24 = String(req.body?.time24 || '');
    const lockProvider = Boolean(bundle.clinic.reschedulePolicy?.lockProvider);
    const lockLocation = Boolean(bundle.clinic.reschedulePolicy?.lockLocation);
    const requestedProviderId = String(
      req.body?.providerId || current.providerId
    );
    const requestedLocationId = String(
      req.body?.locationId || current.locationId
    );

    if (lockProvider && requestedProviderId !== current.providerId) {
      res.status(400).json({
        error: 'This clinic does not allow changing specialist during reschedule.',
      });
      return;
    }
    if (lockLocation && requestedLocationId !== current.locationId) {
      res.status(400).json({
        error: 'This clinic does not allow changing location during reschedule.',
      });
      return;
    }

    const newProviderId = lockProvider ? current.providerId : requestedProviderId;
    const newLocationId = lockLocation ? current.locationId : requestedLocationId;
    const newVisitMode: 'in-person' = 'in-person';

    if (!newDate || !newTime24) {
      res.status(400).json({ error: 'New date and time are required.' });
      return;
    }

    const provider =
      bundle.providers.find((p) => p.id === newProviderId) ||
      bundle.providers.find((p) => p.id === current.providerId);

    const slots = generateAvailableSlots(
      newDate,
      provider ? provider.id : current.providerId,
      store.appointments,
      current.id
    );
    const slot = slots.find((s) => s.time24 === newTime24);
    if (!slot || !slot.available) {
      res.status(409).json({
        error:
          'The selected time slot is unavailable. Please select a different slot.',
      });
      return;
    }

    const location = bundle.clinic.locations.find((l) => l.id === newLocationId);

    const updated: Appointment = {
      ...current,
      previousDate: current.date,
      previousTime24: current.time24,
      date: newDate,
      time24: newTime24,
      providerId: provider ? provider.id : current.providerId,
      providerName: provider ? provider.name : current.providerName,
      providerCredentials: provider
        ? provider.credentials
        : current.providerCredentials,
      visitMode: newVisitMode,
      locationId: location?.id || current.locationId,
      locationName: location?.name || current.locationName,
      locationAddress: location
        ? `${location.address}, ${location.cityStateZip}`
        : current.locationAddress,
      status: 'rescheduled',
      updatedAt: new Date().toISOString(),
    };

    store.appointments[apptIndex] = updated;
    saveStore(store);
    res.json(updated);
  });

  app.post('/api/appointments/:id/cancel', (req, res) => {
    const apptIndex = store.appointments.findIndex(
      (a) => a.id === req.params.id
    );
    if (apptIndex === -1) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const current = store.appointments[apptIndex];
    if (current.status === 'cancelled') {
      res.json(current);
      return;
    }

    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      res.status(400).json({ error: 'Cancellation reason is required.' });
      return;
    }
    const updated: Appointment = {
      ...current,
      status: 'cancelled',
      cancellationReason: reason,
      updatedAt: new Date().toISOString(),
    };

    store.appointments[apptIndex] = updated;
    saveStore(store);
    res.json(updated);
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Patient Appointment Portal server listening on port ${port}`);
  });
}

startServer();
