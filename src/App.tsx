import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, MapPin, X } from 'lucide-react';
import {
  DEFAULT_CLINIC_SLUG,
  getClinicBundle,
  listConfiguredClinics,
  resolveClinicRoute,
} from './config';
import { DEFAULT_PATIENTS, REFERENCE_TODAY_ISO } from './data/seedClinicData';
import {
  cancelAppointment,
  createAppointment,
  fetchAppointments,
  fetchPatientById,
  rescheduleAppointment,
} from './services/clinicApi';
import type {
  Appointment,
  BookingDraft,
  PatientProfile,
  VisitMode,
} from './types/clinic';
import {
  filterUpcomingAppointments,
  formatDateLabel,
  formatTime12h,
} from './utils/appointments';
import { TopBar, type PortalSection } from './components/TopBar';
import { PatientBlock } from './components/PatientBlock';
import { PatientVerificationGate } from './components/PatientVerificationGate';
import { AppointmentsView } from './components/AppointmentsView';
import { BookingWizard } from './components/BookingWizard';
import { CareTeamView } from './components/CareTeamView';
import { ClinicInfoView } from './components/ClinicInfoView';
import { RescheduleModal } from './components/RescheduleModal';
import { CancelModal } from './components/CancelModal';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
  }
  return 'light';
}

function getSessionKey(clinicId: string): string {
  return `clinic-portal-patient-id:${clinicId}`;
}

export default function App() {
  const resolvedRoute = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        slug: DEFAULT_CLINIC_SLUG,
        bundle: getClinicBundle(DEFAULT_CLINIC_SLUG),
        isUnknownPath: false,
      };
    }
    return resolveClinicRoute(
      window.location.pathname,
      window.location.search,
      import.meta.env.VITE_DEFAULT_CLINIC_ID || DEFAULT_CLINIC_SLUG
    );
  }, []);

  const activeBundle =
    resolvedRoute.bundle || getClinicBundle(DEFAULT_CLINIC_SLUG);
  const { clinic, providers, appointmentTypes } = activeBundle;

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [activeSection, setActiveSection] =
    useState<PortalSection>('appointments');
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [patientKind, setPatientKind] = useState<'established' | 'new' | null>(
    null
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(
    null
  );

  const [bookingPreselect, setBookingPreselect] = useState<{
    appointmentTypeId?: string;
  }>({});

  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(
    null
  );
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

  const [announcement, setAnnouncement] = useState<string | null>(null);

  const upcomingCount = useMemo(
    () =>
      filterUpcomingAppointments(appointments, '', REFERENCE_TODAY_ISO).length,
    [appointments]
  );

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem('clinic-portal-theme', next);
      } catch {}
      return next;
    });
  };

  const showAnnouncement = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => setAnnouncement(null), 6500);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  // Keep document title & metadata synced with whichever clinic config is active
  useEffect(() => {
    if (resolvedRoute.isUnknownPath) {
      document.title = 'Clinic Portal Not Found';
      return;
    }
    const pageTitle = `${clinic.name} — Patient Appointment Portal`;
    document.title = pageTitle;
    const desc = `Book, reschedule, or cancel in-person appointments at ${clinic.name} (${clinic.specialty}).`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', pageTitle);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);
  }, [clinic.name, clinic.specialty, resolvedRoute.isUnknownPath]);

  const loadPatientAppointments = useCallback(
    async (patientId: string, clinicSlug: string) => {
      setLoadingAppointments(true);
      setAppointmentsError(null);
      try {
        const [patientRes, apptsRes] = await Promise.all([
          fetchPatientById(patientId),
          fetchAppointments(patientId, clinicSlug),
        ]);
        setPatient(patientRes);
        setPatientKind('established');
        setAppointments(apptsRes);
      } catch (err) {
        setAppointmentsError(
          err instanceof Error
            ? err.message
            : 'Unable to load upcoming appointments.'
        );
      } finally {
        setLoadingAppointments(false);
      }
    },
    []
  );

  useEffect(() => {
    if (resolvedRoute.isUnknownPath) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';
    let sessionPatientId: string | null = null;
    try {
      sessionPatientId = sessionStorage.getItem(getSessionKey(clinic.id));
    } catch {}

    if (sessionPatientId) {
      loadPatientAppointments(sessionPatientId, clinic.id);
    } else if (autostart) {
      loadPatientAppointments(DEFAULT_PATIENTS[0].id, clinic.id);
    }
  }, [clinic.id, loadPatientAppointments, resolvedRoute.isUnknownPath]);

  const handlePatientVerified = useCallback(
    async (verified: PatientProfile, kind: 'established' | 'new') => {
      setPatient(verified);
      setPatientKind(kind);
      try {
        sessionStorage.setItem(getSessionKey(clinic.id), verified.id);
      } catch {}
      const appts = await fetchAppointments(verified.id, clinic.id);
      setAppointments(appts);
      setActiveSection('appointments');
      showAnnouncement(
        kind === 'new'
          ? `Registered new patient profile for ${verified.fullName}.`
          : `Verified established patient record for ${verified.fullName}.`
      );
    },
    [clinic.id, showAnnouncement]
  );

  const handleSignOutPatient = () => {
    setPatient(null);
    setPatientKind(null);
    setAppointments([]);
    try {
      sessionStorage.removeItem(getSessionKey(clinic.id));
    } catch {}
    setActiveSection('appointments');
  };

  const handleStartBooking = (preselect?: {
    appointmentTypeId?: string;
  }) => {
    setBookingPreselect(preselect || {});
    setActiveSection('book');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateAppointment = async (
    draft: BookingDraft
  ): Promise<Appointment> => {
    if (!patient) {
      throw new Error(
        'Patient verification or registration is required before booking.'
      );
    }

    const created = await createAppointment(patient.id, clinic.id, draft);
    const refreshed = await fetchAppointments(patient.id, clinic.id);
    setAppointments(refreshed);
    showAnnouncement(
      `Appointment confirmed for ${formatDateLabel(created.date)} at ${formatTime12h(created.time24)}.`
    );
    return created;
  };

  const handleRescheduleConfirm = async (
    appointmentId: string,
    payload: {
      date: string;
      time24: string;
      providerId: string;
      locationId: string;
      visitMode: VisitMode;
    }
  ) => {
    const updated = await rescheduleAppointment(
      appointmentId,
      clinic.id,
      payload
    );
    setAppointments((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
    showAnnouncement(
      `Appointment rescheduled to ${formatDateLabel(updated.date)} at ${formatTime12h(updated.time24)}.`
    );
  };

  const handleCancelConfirm = async (appointmentId: string, reason: string) => {
    const updated = await cancelAppointment(appointmentId, reason);
    setAppointments((prev) => prev.filter((a) => a.id !== updated.id));
    showAnnouncement(
      `Your ${updated.appointmentTypeName} appointment on ${formatDateLabel(updated.date)} has been cancelled.`
    );
  };

  if (resolvedRoute.isUnknownPath) {
    const configuredClinics = listConfiguredClinics();
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <main className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Clinic Portal Template
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
            Clinic path &ldquo;/{resolvedRoute.slug}&rdquo; not configured
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Select a configured clinic portal path below, or add a clinic config
            under <code className="font-mono text-xs">src/config/clinics/</code>.
          </p>
          <ul className="mt-5 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {configuredClinics.map((item) => (
              <li key={item.slug}>
                <a
                  href={item.path}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {item.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{item.path}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.specialty}</span>
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-teal-700 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <TopBar
        clinicShortName={clinic.shortName}
        isPatientVerified={Boolean(patient)}
        upcomingCount={upcomingCount}
        activeSection={activeSection}
        onNavigate={(section) => {
          if (section === 'book') {
            setBookingPreselect({});
          }
          setActiveSection(section);
        }}
        onStartBooking={() => handleStartBooking()}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-md"
      >
        {announcement ? (
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 shadow-md dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>{announcement}</span>
            </div>
            <button
              type="button"
              onClick={() => setAnnouncement(null)}
              aria-label="Dismiss notification"
              className="rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 space-y-2.5 px-4 py-3 sm:px-6 lg:px-8 focus:outline-none"
      >
        {patient ? (
          <PatientBlock
            clinic={clinic}
            patient={patient}
            patientKind={patientKind}
            onLogoutPatient={handleSignOutPatient}
          />
        ) : null}

        {!patient &&
        (activeSection === 'appointments' || activeSection === 'book') ? (
          <PatientVerificationGate
            clinic={clinic}
            onPatientVerified={handlePatientVerified}
          />
        ) : null}

        {patient && activeSection === 'appointments' ? (
          <AppointmentsView
            clinic={clinic}
            patientId={patient.id}
            appointments={appointments}
            loading={loadingAppointments}
            error={appointmentsError}
            onStartBooking={handleStartBooking}
            onOpenReschedule={(appt) => setRescheduleTarget(appt)}
            onOpenCancel={(appt) => setCancelTarget(appt)}
            onRetryLoad={() => loadPatientAppointments(patient.id, clinic.id)}
          />
        ) : null}

        {patient && activeSection === 'book' ? (
          <BookingWizard
            key={clinic.id}
            clinic={clinic}
            providers={providers}
            appointmentTypes={appointmentTypes}
            patient={patient}
            appointments={appointments}
            loadingAppointments={loadingAppointments}
            initialAppointmentTypeId={bookingPreselect.appointmentTypeId}
            onSubmitBooking={handleCreateAppointment}
            onFinishToAppointments={() => setActiveSection('appointments')}
            onOpenReschedule={(appt) => setRescheduleTarget(appt)}
            onOpenCancel={(appt) => setCancelTarget(appt)}
          />
        ) : null}

        {activeSection === 'team' ? (
          <CareTeamView clinic={clinic} providers={providers} />
        ) : null}

        {activeSection === 'clinic' ? (
          <ClinicInfoView clinic={clinic} />
        ) : null}
      </main>

      <RescheduleModal
        appointment={rescheduleTarget}
        clinic={clinic}
        providers={providers}
        appointments={appointments}
        onClose={() => setRescheduleTarget(null)}
        onConfirm={handleRescheduleConfirm}
      />

      <CancelModal
        appointment={cancelTarget}
        cancellationPolicyHours={clinic.cancellationPolicyHours}
        cancellationReasons={clinic.cancellationReasons}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
      />
    </div>
  );
}
