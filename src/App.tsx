import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowRight, CheckCircle2, MapPin, X } from 'lucide-react';
import {
  DEFAULT_CLINIC_SLUG,
  getClinicBundle,
  listConfiguredClinics,
  resolveClinicRoute,
} from './config';
import { DEFAULT_PATIENTS, REFERENCE_TODAY_ISO } from './data/seedClinicData';
import {
  ApiError,
  cancelAppointment,
  createAppointment,
  fetchAppointments,
  fetchPatientById,
  rescheduleAppointment,
  keepSessionAlive,
  setOnSessionExpiredHandler,
  setSessionToken,
} from './services/clinicApi';
import type {
  Appointment,
  BookingDraft,
  PatientProfile,
  VisitMode,
} from './types/clinic';
import {
  filterUpcomingAppointments,
  formatDateWithWeekday,
  formatTime12h,
} from './utils/appointments';
import { applyClinicThemeVariables } from './utils/theme';
import { TopBar, type PortalSection } from './components/TopBar';
import { SessionTimeoutModal } from './components/SessionTimeoutModal';
import { ConfirmLeaveBookingModal } from './components/ConfirmLeaveBookingModal';
import {
  AppointmentsViewSkeleton,
  BookingWizardSkeleton,
  CareTeamSkeleton,
  ClinicInfoSkeleton,
  PatientVerificationSkeleton,
} from './components/PortalSkeletons';
import { Footer } from './components/Footer';

const PatientVerificationGate = lazy(() =>
  import('./components/PatientVerificationGate').then((m) => ({
    default: m.PatientVerificationGate,
  }))
);
const AppointmentsView = lazy(() =>
  import('./components/AppointmentsView').then((m) => ({
    default: m.AppointmentsView,
  }))
);
const BookingWizard = lazy(() =>
  import('./components/BookingWizard').then((m) => ({
    default: m.BookingWizard,
  }))
);
const CareTeamView = lazy(() =>
  import('./components/CareTeamView').then((m) => ({
    default: m.CareTeamView,
  }))
);
const ClinicInfoView = lazy(() =>
  import('./components/ClinicInfoView').then((m) => ({
    default: m.ClinicInfoView,
  }))
);
const RescheduleModal = lazy(() =>
  import('./components/RescheduleModal').then((m) => ({
    default: m.RescheduleModal,
  }))
);
const CancelModal = lazy(() =>
  import('./components/CancelModal').then((m) => ({
    default: m.CancelModal,
  }))
);

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

function getSectionFromUrl(): PortalSection {
  if (typeof window === 'undefined') return 'appointments';
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (tab === 'book' || tab === 'team' || tab === 'clinic') {
    return tab;
  }
  return 'appointments';
}

function syncSectionToUrl(section: PortalSection, replace = false) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (section === 'appointments') {
    url.searchParams.delete('tab');
  } else {
    url.searchParams.set('tab', section);
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;
  if (replace) {
    window.history.replaceState({ section }, '', nextUrl);
  } else {
    window.history.pushState({ section }, '', nextUrl);
  }
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
    useState<PortalSection>(getSectionFromUrl);
  const [bookingHasUnsavedChanges, setBookingHasUnsavedChanges] =
    useState(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<
    { type: 'navigate'; section: PortalSection } | { type: 'logout' } | null
  >(null);
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
  const [bookingSessionId, setBookingSessionId] = useState(0);

  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(
    null
  );
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

  const [announcement, setAnnouncement] = useState<string | null>(null);
  const lastActivityTimeRef = useRef(Date.now());
  const lastServerKeepAliveRef = useRef(Date.now());
  const patientRef = useRef<PatientProfile | null>(null);
  patientRef.current = patient;
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  const showAnnouncement = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => setAnnouncement(null), 6500);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  useEffect(() => {
    setOnSessionExpiredHandler((message) => {
      const wasSignedIn = Boolean(patientRef.current);
      setPatient(null);
      setPatientKind(null);
      setAppointments([]);
      setAppointmentsError(null);
      setRescheduleTarget(null);
      setCancelTarget(null);
      setShowTimeoutWarning(false);
      setBookingHasUnsavedChanges(false);
      setPendingLeaveAction(null);
      setActiveSection('appointments');
      syncSectionToUrl('appointments', true);
      try {
        sessionStorage.removeItem(getSessionKey(clinic.id));
      } catch {}
      if (wasSignedIn) {
        showAnnouncement(
          message ||
            'Your session expired due to inactivity. Please verify your details again.'
        );
      }
    });
    return () => setOnSessionExpiredHandler(null);
  }, [clinic.id, showAnnouncement]);

  useEffect(() => {
    const handlePopState = () => {
      setBookingHasUnsavedChanges(false);
      setPendingLeaveAction(null);
      setActiveSection(getSectionFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!patient) return;
    lastActivityTimeRef.current = Date.now();
    lastServerKeepAliveRef.current = Date.now();

    const handleActivity = () => {
      const now = Date.now();
      lastActivityTimeRef.current = now;
      if (now - lastServerKeepAliveRef.current >= 2 * 60 * 1000) {
        lastServerKeepAliveRef.current = now;
        void keepSessionAlive();
      }
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityTimeRef.current;
      if (elapsed >= 15 * 60 * 1000) {
        setPatient(null);
        setPatientKind(null);
        setAppointments([]);
        setAppointmentsError(null);
        setRescheduleTarget(null);
        setCancelTarget(null);
        setSessionToken(null);
        setShowTimeoutWarning(false);
        setBookingHasUnsavedChanges(false);
        setPendingLeaveAction(null);
        setActiveSection('appointments');
        syncSectionToUrl('appointments', true);
        try {
          sessionStorage.removeItem(getSessionKey(clinic.id));
        } catch {}
        showAnnouncement('Your session expired due to inactivity.');
      } else if (elapsed >= 13 * 60 * 1000) {
        setShowTimeoutWarning(true);
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.clearInterval(interval);
    };
  }, [patient, clinic.id, showAnnouncement]);

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



  useLayoutEffect(() => {
    applyClinicThemeVariables(clinic.themeColor);
  }, [clinic.themeColor]);

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
        if (err instanceof ApiError && err.status === 401) {
          setAppointmentsError(null);
          return;
        }
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
      setAppointmentsError(null);
      const appts = await fetchAppointments(verified.id, clinic.id);
      lastActivityTimeRef.current = Date.now();
      lastServerKeepAliveRef.current = Date.now();
      setPatient(verified);
      setPatientKind(kind);
      setAppointments(appts);
      try {
        sessionStorage.setItem(getSessionKey(clinic.id), verified.id);
      } catch {}
      setActiveSection('appointments');
      syncSectionToUrl('appointments', true);
      showAnnouncement(
        kind === 'new'
          ? `Registered new patient profile for ${verified.fullName}.`
          : `Verified established patient record for ${verified.fullName}.`
      );
    },
    [clinic.id, showAnnouncement]
  );

  const performSectionNavigation = useCallback(
    (section: PortalSection, options?: { replace?: boolean }) => {
      if (section === 'book') {
        setBookingPreselect({});
        setBookingSessionId((prev) => prev + 1);
      }
      setBookingHasUnsavedChanges(false);
      setActiveSection(section);
      syncSectionToUrl(section, Boolean(options?.replace));
    },
    []
  );

  const handleSignOutPatient = useCallback(() => {
    setPatient(null);
    setPatientKind(null);
    setAppointments([]);
    setAppointmentsError(null);
    setSessionToken(null);
    setShowTimeoutWarning(false);
    setBookingHasUnsavedChanges(false);
    setPendingLeaveAction(null);
    try {
      sessionStorage.removeItem(getSessionKey(clinic.id));
    } catch {}
    setActiveSection('appointments');
    syncSectionToUrl('appointments', true);
  }, [clinic.id]);

  const handleNavigateRequest = useCallback(
    (section: PortalSection) => {
      if (
        patient &&
        activeSection === 'book' &&
        section !== 'book' &&
        bookingHasUnsavedChanges
      ) {
        setPendingLeaveAction({ type: 'navigate', section });
        return;
      }
      performSectionNavigation(section);
    },
    [patient, activeSection, bookingHasUnsavedChanges, performSectionNavigation]
  );

  const handleLogoutRequest = useCallback(() => {
    if (patient && activeSection === 'book' && bookingHasUnsavedChanges) {
      setPendingLeaveAction({ type: 'logout' });
      return;
    }
    handleSignOutPatient();
  }, [patient, activeSection, bookingHasUnsavedChanges, handleSignOutPatient]);

  const handleStartBooking = (preselect?: {
    appointmentTypeId?: string;
  }) => {
    setBookingPreselect(preselect || {});
    setBookingSessionId((prev) => prev + 1);
    setBookingHasUnsavedChanges(false);
    setActiveSection('book');
    syncSectionToUrl('book');
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

    const created = await createAppointment(
      patient.id,
      clinic.id,
      draft
    );
    const refreshed = await fetchAppointments(patient.id, clinic.id);
    setAppointments(refreshed);
    showAnnouncement(
      `Appointment confirmed for ${formatDateWithWeekday(created.date)} at ${formatTime12h(created.time24)}.`
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
      reasonForVisit?: string;
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
      `Appointment rescheduled to ${formatDateWithWeekday(updated.date)} at ${formatTime12h(updated.time24)}.`
    );
  };

  const handleCancelConfirm = async (appointmentId: string, reason: string) => {
    const updated = await cancelAppointment(appointmentId, reason);
    setAppointments((prev) => prev.filter((a) => a.id !== updated.id));
    showAnnouncement(
      `Your ${updated.appointmentTypeName} appointment on ${formatDateWithWeekday(updated.date)} has been cancelled.`
    );
  };

  if (resolvedRoute.isUnknownPath) {
    const configuredClinics = listConfiguredClinics();
    return (
      <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <main className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-text dark:text-brand-text-dark">
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
                      className="h-4 w-4 shrink-0 text-brand-text dark:text-brand-text-dark"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </main>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-brand-fg focus:shadow-lg"
      >
        Skip to main content
      </a>

      <TopBar
        clinicShortName={clinic.shortName}
        patient={patient}
        patientKind={patientKind}
        upcomingCount={upcomingCount}
        activeSection={activeSection}
        onNavigate={handleNavigateRequest}
        onLogoutPatient={handleLogoutRequest}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-40 sm:w-[calc(100%-2rem)] max-w-md"
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
        className="mx-auto w-full min-w-0 max-w-7xl flex-1 flex flex-col overflow-hidden px-3 py-2.5 sm:px-6 sm:py-4 lg:px-8 focus:outline-none"
      >
        {!patient &&
        (activeSection === 'appointments' || activeSection === 'book') ? (
          <Suspense fallback={<PatientVerificationSkeleton />}>
            <PatientVerificationGate
              clinic={clinic}
              onPatientVerified={handlePatientVerified}
            />
          </Suspense>
        ) : null}

        {patient && activeSection === 'appointments' ? (
          <Suspense fallback={<AppointmentsViewSkeleton />}>
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
          </Suspense>
        ) : null}

        {patient && activeSection === 'book' ? (
          <Suspense fallback={<BookingWizardSkeleton />}>
            <BookingWizard
              key={`${clinic.id}-${bookingSessionId}`}
              clinic={clinic}
              providers={providers}
              appointmentTypes={appointmentTypes}
              patient={patient}
              patientKind={patientKind}
              appointments={appointments}
              loading={loadingAppointments}
              initialAppointmentTypeId={bookingPreselect.appointmentTypeId}
              onSubmitBooking={handleCreateAppointment}
              onFinishToAppointments={() => performSectionNavigation('appointments')}
              onUnsavedProgressChange={setBookingHasUnsavedChanges}
            />
          </Suspense>
        ) : null}

        {activeSection === 'team' ? (
          <Suspense fallback={<CareTeamSkeleton />}>
            <CareTeamView clinic={clinic} providers={providers} />
          </Suspense>
        ) : null}

        {activeSection === 'clinic' ? (
          <Suspense fallback={<ClinicInfoSkeleton />}>
            <ClinicInfoView clinic={clinic} />
          </Suspense>
        ) : null}
      </main>

      <Footer />

      <Suspense fallback={null}>
        {rescheduleTarget ? (
          <RescheduleModal
            appointment={rescheduleTarget}
            clinic={clinic}
            providers={providers}
            appointments={appointments}
            onClose={() => setRescheduleTarget(null)}
            onConfirm={handleRescheduleConfirm}
          />
        ) : null}

        {cancelTarget ? (
          <CancelModal
            appointment={cancelTarget}
            cancellationPolicyHours={clinic.cancellationPolicyHours}
            cancellationReasons={clinic.cancellationReasons}
            onClose={() => setCancelTarget(null)}
            onConfirm={handleCancelConfirm}
          />
        ) : null}
      </Suspense>

      <SessionTimeoutModal
        open={showTimeoutWarning}
        onStaySignedIn={async () => {
          await keepSessionAlive();
          lastActivityTimeRef.current = Date.now();
          lastServerKeepAliveRef.current = Date.now();
          setShowTimeoutWarning(false);
        }}
        onSignOut={handleSignOutPatient}
      />

      <ConfirmLeaveBookingModal
        open={Boolean(pendingLeaveAction)}
        onStay={() => setPendingLeaveAction(null)}
        onDiscard={() => {
          const action = pendingLeaveAction;
          setPendingLeaveAction(null);
          if (!action) return;
          if (action.type === 'logout') {
            handleSignOutPatient();
          } else {
            performSectionNavigation(action.section);
          }
        }}
      />
    </div>
  );
}
