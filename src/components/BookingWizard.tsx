import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Stethoscope,
  User,
} from 'lucide-react';
import type {
  Appointment,
  AppointmentType,
  BookingDraft,
  ClinicProfile,
  PatientProfile,
  Provider,
  TimeSlot,
  ValidationErrors,
} from '../types/clinic';
import { fetchAvailability } from '../services/clinicApi';
import {
  formatDateLabel,
  formatTime12h,
  generateAvailableSlots,
  generateIcsContent,
  getAvailableMonths,
  getBookableDates,
  getCalendarMonthGrid,
  getCommonVisitReasons,
  getProviderInitials,
  isReasonSelected,
  resolveProviderForBooking,
  toggleVisitReason,
  validateBookingStep,
} from '../utils/appointments';
import { REFERENCE_TODAY_ISO } from '../data/seedClinicData';

interface BookingWizardProps {
  clinic: ClinicProfile;
  providers: Provider[];
  appointmentTypes: AppointmentType[];
  patient: PatientProfile;
  appointments: Appointment[];
  initialAppointmentTypeId?: string;
  onSubmitBooking: (
    draft: BookingDraft
  ) => Promise<Appointment>;
  onFinishToAppointments: () => void;
}

const STEPS = [
  {
    num: 1,
    label: 'Location',
    question: 'Which clinic location would you like to visit?',
    icon: MapPin,
  },
  {
    num: 2,
    label: 'Visit Type',
    question: 'What type of visit do you need?',
    icon: Stethoscope,
  },
  {
    num: 3,
    label: 'Specialist',
    question: 'Which specialist would you like to see?',
    icon: User,
  },
  {
    num: 4,
    label: 'Date & Time',
    question: 'When would you like to come in?',
    icon: Calendar,
  },
  {
    num: 5,
    label: 'Reason',
    question: 'What is the reason for your visit?',
    icon: FileText,
  },
  {
    num: 6,
    label: 'Review',
    question: 'Review and confirm your appointment',
    icon: CheckCircle2,
  },
] as const;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function BookingWizard({
  clinic,
  providers,
  appointmentTypes,
  patient,
  appointments,
  initialAppointmentTypeId,
  onSubmitBooking,
  onFinishToAppointments,
}: BookingWizardProps) {
  const bookableDates = getBookableDates(REFERENCE_TODAY_ISO, 90);
  const minBookableIso = bookableDates[0] || REFERENCE_TODAY_ISO;
  const maxBookableIso =
    bookableDates[bookableDates.length - 1] || REFERENCE_TODAY_ISO;
  const availableMonths = getAvailableMonths(REFERENCE_TODAY_ISO, 90);

  const [monthIndex, setMonthIndex] = useState(0);
  const activeMonth = availableMonths[monthIndex] || {
    year: 2026,
    month: 11,
    key: '2026-11',
    label: 'November 2026',
  };
  const monthCells = getCalendarMonthGrid(
    activeMonth.year,
    activeMonth.month,
    minBookableIso,
    maxBookableIso
  );

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<BookingDraft>(() => {
    const initialLocationId = clinic.locations[0]?.id || '';
    const initialProviderId =
      providers.find((p) =>
        initialLocationId ? p.locationIds.includes(initialLocationId) : true
      )?.id ||
      providers[0]?.id ||
      '';
    return {
      appointmentTypeId:
        initialAppointmentTypeId || appointmentTypes[0]?.id || '',
      visitMode: 'in-person',
      locationId: initialLocationId,
      providerId: initialProviderId,
      date: minBookableIso,
      time24: '',
      patientName: patient.fullName,
      dateOfBirth: patient.dateOfBirth,
      patientPhone: patient.phone,
      patientEmail: patient.email || '',
      reasonForVisit: '',
      accommodations: [],
    };
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] =
    useState<Appointment | null>(null);
  const didMountScrollRef = useRef(false);

  const eligibleProviders = providers.filter((p) =>
    draft.locationId ? p.locationIds.includes(draft.locationId) : true
  );

  const getDateSlotCount = (dateIso: string) => {
    const activeProviderId =
      draft.providerId || eligibleProviders[0]?.id || '';
    if (!activeProviderId) return 0;
    const generated = generateAvailableSlots(
      dateIso,
      activeProviderId,
      appointments
    );
    return generated.length;
  };

  const handleMonthNavigate = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= availableMonths.length) return;
    setMonthIndex(newIdx);
    const targetMonth = availableMonths[newIdx];
    if (!targetMonth) return;
    const cells = getCalendarMonthGrid(
      targetMonth.year,
      targetMonth.month,
      minBookableIso,
      maxBookableIso
    );
    // Automatically select the first date in the new month with open slots
    const firstAvailableCell =
      cells.find(
        (c) =>
          c.inCurrentMonth &&
          c.inWindow &&
          c.dateIso &&
          getDateSlotCount(c.dateIso) > 0
      ) || cells.find((c) => c.inCurrentMonth && c.inWindow && c.dateIso);

    const targetDateIso = firstAvailableCell?.dateIso;
    if (targetDateIso) {
      setDraft((prev) => ({
        ...prev,
        date: targetDateIso,
        time24: '',
      }));
      if (errors.date || errors.time24) {
        setErrors((prev) => ({ ...prev, date: '', time24: '' }));
      }
    }
  };

  useEffect(() => {
    if (!didMountScrollRef.current) {
      didMountScrollRef.current = true;
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [step, confirmedAppointment]);

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      patientName: patient.fullName,
      dateOfBirth: patient.dateOfBirth,
      patientPhone: patient.phone,
      patientEmail: patient.email || '',
      accommodations: [],
    }));
  }, [patient]);

  useEffect(() => {
    if (initialAppointmentTypeId) {
      setDraft((prev) => ({
        ...prev,
        appointmentTypeId: initialAppointmentTypeId,
      }));
    }
  }, [initialAppointmentTypeId]);

  const selectedType = appointmentTypes.find(
    (t) => t.id === draft.appointmentTypeId
  );

  // Load live available slots when in Step 4 (Date & Time)
  useEffect(() => {
    const activeProviderId =
      draft.providerId || eligibleProviders[0]?.id || '';
    if (step !== 4 || !draft.date || !activeProviderId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSubmitError('');

    fetchAvailability({
      date: draft.date,
      providerId: activeProviderId,
      clinicSlug: clinic.id,
    })
      .then((res) => {
        if (!cancelled) {
          setSlots(res.slots);
          if (
            draft.time24 &&
            !res.slots.some((s) => s.time24 === draft.time24 && s.available)
          ) {
            setDraft((prev) => ({ ...prev, time24: '' }));
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSlots([]);
          setSubmitError(
            err instanceof Error
              ? err.message
              : 'Unable to load available times.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, draft.date, draft.providerId, clinic.id]);

  const handleNext = () => {
    const stepErrors = validateBookingStep(step, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((prev) => Math.min(STEPS.length, prev + 1));
  };

  const handleBack = () => {
    setErrors({});
    setSubmitError('');
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleConfirmBooking = async () => {
    const allErrors = validateBookingStep(6, draft);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await onSubmitBooking(draft);
      setConfirmedAppointment(created);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Could not complete booking. Please check your time slot.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadIcs = (appt: Appointment) => {
    const location = clinic.locations.find((l) => l.id === appt.locationId);
    const ics = generateIcsContent(appt, clinic, location);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appt.confirmationCode.toLowerCase()}-appointment.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resolvedProvider = resolveProviderForBooking(
    draft.providerId,
    providers,
    draft.locationId,
    draft.visitMode
  );
  const selectedLocation = clinic.locations.find(
    (l) => l.id === draft.locationId
  );

  const morningSlots = slots.filter((s) => s.period === 'morning');
  const afternoonSlots = slots.filter((s) => s.period === 'afternoon');
  const currentStepMeta = STEPS[step - 1] || STEPS[0];

  if (confirmedAppointment) {
    return (
      <section
        aria-labelledby="booking-confirmed-title"
        className="w-full rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <div role="status" className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Appointment Confirmed
              </p>
              <h1
                id="booking-confirmed-title"
                className="mt-0.5 font-display text-xl font-bold text-slate-900 dark:text-slate-50"
              >
                You are scheduled for{' '}
                {formatDateLabel(confirmedAppointment.date)}
              </h1>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                Your appointment has been successfully scheduled and confirmed.
              </p>
            </div>
          </div>

          <div data-testid="confirmed-single-col" className="mt-5 space-y-4">
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Patient
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {confirmedAppointment.patientName}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Visit Type
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  {confirmedAppointment.appointmentTypeName} (
                  {confirmedAppointment.durationMinutes} min)
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Specialist
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                  <User
                    className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {confirmedAppointment.providerName},{' '}
                    {confirmedAppointment.providerCredentials}
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Date &amp; Time
                </span>
                <span className="inline-flex flex-wrap items-center gap-1.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  <Calendar
                    className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{formatDateLabel(confirmedAppointment.date)}</span>
                  <Clock
                    className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 ml-1"
                    aria-hidden="true"
                  />
                  <span>{formatTime12h(confirmedAppointment.time24)}</span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Location
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100 sm:text-right">
                  <MapPin
                    className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{confirmedAppointment.locationName}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-nowrap items-center justify-between gap-2 sm:gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleDownloadIcs(confirmedAppointment)}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">Calendar (.ics)</span>
            <span className="hidden sm:inline">Add to Calendar (.ics)</span>
          </button>

          <button
            type="button"
            onClick={onFinishToAppointments}
            className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-3.5 py-2 text-xs sm:px-5 sm:text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <span className="sm:hidden">My Appointments</span>
            <span className="hidden sm:inline">View My Appointments</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="book-wizard-heading"
      className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Compact Header with 1-6 Icon Node Timeline */}
      <div className="border-b border-slate-200 px-4 py-3.5 sm:px-6 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300 whitespace-nowrap">
            Book an Appointment
          </p>
          <span
            data-testid="booking-step-indicator"
            className="font-mono text-[11px] sm:text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0"
          >
            Step {step} of {STEPS.length}
            <span className="sm:hidden font-sans font-semibold text-teal-700 dark:text-teal-300">
              {' '}
              · {currentStepMeta.label}
            </span>
          </span>
        </div>
        <h1
          id="book-wizard-heading"
          className="mt-1 font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance"
        >
          {currentStepMeta.question}
        </h1>

        {/* 1-6 Node Timeline with Icons — equal connector spacing across mobile, tablet, and laptop */}
        <nav
          aria-label="Booking progress"
          data-testid="booking-node-timeline"
          className="mt-3 sm:mt-3.5"
        >
          <ol className="flex items-start justify-between sm:pb-5">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isCurrent = step === s.num;
              const isComplete = step > s.num;
              const isLast = idx === STEPS.length - 1;

              return (
                <li
                  key={s.num}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-w-0 items-start ${isLast ? 'shrink-0' : 'flex-1'}`}
                >
                  <div className="relative flex flex-col items-center">
                    <div
                      className={`relative flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 transition-colors ${
                        isCurrent
                          ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-500 dark:text-slate-950'
                          : isComplete
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-500'
                      }`}
                    >
                      {isComplete ? (
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
                      ) : (
                        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <span
                      className={`hidden sm:block sm:absolute sm:top-9 sm:left-1/2 sm:-translate-x-1/2 whitespace-nowrap text-[11px] ${
                        isCurrent
                          ? 'font-semibold text-teal-700 dark:text-teal-300'
                          : isComplete
                            ? 'font-medium text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>

                  {!isLast ? (
                    <div
                      aria-hidden="true"
                      className="flex h-6 sm:h-8 flex-1 items-center px-0.5 sm:px-2"
                    >
                      <div
                        className={`h-0.5 w-full rounded-full transition-colors ${
                          isComplete
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Step Body */}
      <div className="min-w-0 p-4 sm:p-5">
        {/* STEP 1: CLINIC LOCATION (Strict 2-column grid) */}
        {step === 1 ? (
          <div className="min-w-0">
            <div
              data-testid="locations-grid"
              className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
            >
              {clinic.locations.map((loc) => {
                const selected = draft.locationId === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setDraft((prev) => {
                        const currentProvValid = providers.some(
                          (p) =>
                            p.id === prev.providerId &&
                            p.locationIds.includes(loc.id)
                        );
                        const fallbackProviderId =
                          providers.find((p) =>
                            p.locationIds.includes(loc.id)
                          )?.id || '';
                        return {
                          ...prev,
                          locationId: loc.id,
                          visitMode: 'in-person',
                          providerId: currentProvValid
                            ? prev.providerId
                            : fallbackProviderId,
                          time24: currentProvValid ? prev.time24 : '',
                        };
                      });
                      if (errors.locationId) {
                        setErrors((prev) => ({ ...prev, locationId: '' }));
                      }
                    }}
                    aria-pressed={selected}
                    aria-label={`${loc.name}, ${loc.address}, ${loc.cityStateZip}`}
                    className={`flex w-full min-w-0 items-start justify-between gap-3 rounded-lg border p-3.5 sm:p-4 text-left transition-colors ${
                      selected
                        ? 'border-teal-700 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {loc.name}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-slate-600 dark:text-slate-300">
                        <MapPin
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-400"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 break-words">
                          {loc.address}, {loc.cityStateZip}
                        </span>
                      </p>
                      <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                        {loc.hours}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-500 dark:text-slate-950'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {selected ? <Check className="h-2.5 w-2.5" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.locationId ? (
              <p
                role="alert"
                className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.locationId}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* STEP 2: VISIT TYPE (Strict 2-column grid, full short description without truncation) */}
        {step === 2 ? (
          <div className="min-w-0">
            <div
              data-testid="visit-types-grid"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {appointmentTypes.map((type) => {
                const selected = draft.appointmentTypeId === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        appointmentTypeId: type.id,
                      }));
                      if (errors.appointmentTypeId) {
                        setErrors((prev) => ({
                          ...prev,
                          appointmentTypeId: '',
                        }));
                      }
                    }}
                    aria-pressed={selected}
                    className={`flex w-full min-w-0 items-start justify-between gap-2.5 rounded-lg border p-3.5 text-left transition-colors ${
                      selected
                        ? 'border-teal-700 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">
                          {type.name}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                          {type.durationMinutes} min
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs leading-snug text-slate-600 dark:text-slate-300">
                        {type.description}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-500 dark:text-slate-950'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {selected ? <Check className="h-2.5 w-2.5" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.appointmentTypeId ? (
              <p
                role="alert"
                className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.appointmentTypeId}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* STEP 3: SPECIALIST (Strict 2-column grid) */}
        {step === 3 ? (
          <div className="min-w-0">
            <div
              data-testid="providers-grid"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {eligibleProviders.map((prov) => {
                const selected = draft.providerId === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        providerId: prov.id,
                        time24: '',
                      }));
                      if (errors.providerId) {
                        setErrors((prev) => ({ ...prev, providerId: '' }));
                      }
                    }}
                    aria-pressed={selected}
                    className={`flex w-full min-w-0 items-center gap-3 rounded-lg border p-3.5 text-left transition-colors min-h-[60px] ${
                      selected
                        ? 'border-teal-700 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 font-display text-xs font-bold text-teal-800 dark:border-slate-700 dark:bg-slate-800 dark:text-teal-300"
                    >
                      {getProviderInitials(prov.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {prov.name}, {prov.credentials}
                      </span>
                      <span className="block break-words text-xs text-slate-600 dark:text-slate-300">
                        {prov.specialty}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.providerId ? (
              <p
                role="alert"
                className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.providerId}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* STEP 4: COMPACT 1-MONTH CALENDAR (LEFT) + TIME SLOTS (RIGHT) — ZERO SCROLL EVEN ON 31-DAY 6-ROW MONTHS */}
        {step === 4 ? (
          <div className="grid min-w-0 gap-4 lg:grid-cols-12 lg:items-start">
            {/* Left: Compact 1-Month Calendar */}
            <div className="min-w-0 lg:col-span-7">
              <div className="flex items-center justify-between gap-2 pb-2">
                <h2
                  data-testid="calendar-month-title"
                  className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50"
                >
                  {activeMonth.label}
                </h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={monthIndex === 0}
                    onClick={() => handleMonthNavigate(monthIndex - 1)}
                    aria-label="Previous month"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={monthIndex >= availableMonths.length - 1}
                    onClick={() => handleMonthNavigate(monthIndex + 1)}
                    aria-label="Next month"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="grid grid-cols-7 gap-1 pb-1 text-center">
                  {WEEKDAYS.map((day) => (
                    <span
                      key={day}
                      className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {day}
                    </span>
                  ))}
                </div>

                <div
                  data-testid="month-calendar-grid"
                  className="grid grid-cols-7 gap-1"
                >
                  {monthCells.map((cell, idx) => {
                    if (!cell.inCurrentMonth || !cell.dateIso || !cell.dayNumber) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          aria-hidden="true"
                          className="h-9 sm:h-[38px]"
                        />
                      );
                    }

                    const dateIso = cell.dateIso;
                    const count = cell.inWindow ? getDateSlotCount(dateIso) : 0;
                    const isDisabled = !cell.inWindow || count === 0;
                    const selected = draft.date === dateIso;

                    return (
                      <button
                        key={dateIso}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (!isDisabled) {
                            setDraft((prev) => ({
                              ...prev,
                              date: dateIso,
                              time24: '',
                            }));
                            if (errors.date || errors.time24) {
                              setErrors((prev) => ({
                                ...prev,
                                date: '',
                                time24: '',
                              }));
                            }
                          }
                        }}
                        aria-pressed={selected}
                        aria-label={
                          isDisabled
                            ? `${formatDateLabel(dateIso)}, unavailable`
                            : `${formatDateLabel(dateIso)}, ${count} open slots`
                        }
                        className={`flex flex-col items-center justify-center rounded-md border px-1 py-0.5 transition-colors h-9 sm:h-[38px] ${
                          isDisabled
                            ? 'cursor-not-allowed border-transparent bg-transparent text-slate-300 dark:text-slate-700'
                            : selected
                              ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-500 dark:text-slate-950'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-teal-600 hover:bg-teal-50/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-teal-400 dark:hover:bg-slate-900'
                        }`}
                      >
                        <span className="text-xs font-semibold tabular-nums leading-none">
                          {cell.dayNumber}
                        </span>
                        {!isDisabled ? (
                          <span
                            className={`mt-0.5 rounded px-1 font-mono text-[9px] font-semibold tabular-nums leading-none ${
                              selected
                                ? 'bg-teal-900/30 text-white dark:bg-slate-950/25 dark:text-slate-950'
                                : 'bg-teal-50 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300'
                            }`}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="mt-0.5 h-[9px]" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {errors.date ? (
                <p
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-rose-700 dark:text-rose-400"
                >
                  {errors.date}
                </p>
              ) : null}
            </div>

            {/* Right: Available Time Slots */}
            <div
              aria-busy={loadingSlots}
              data-testid="time-slots-panel"
              className="min-w-0 lg:col-span-5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                    Available Times
                  </h2>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatDateLabel(draft.date)}
                  </p>
                </div>
                {loadingSlots ? (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-300"
                  >
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Loading...</span>
                  </span>
                ) : null}
              </div>

              {loadingSlots ? (
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-9 animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800"
                    />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="mt-2.5 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  No open clinic slots on this date. Please select another day on
                  the calendar.
                </p>
              ) : (
                <div
                  data-testid="time-slots-scroll-area"
                  className="mt-2.5 max-h-[268px] space-y-3 overflow-y-auto pr-1"
                >
                  {[
                    { label: 'Morning', items: morningSlots },
                    { label: 'Afternoon', items: afternoonSlots },
                  ].map((group) =>
                    group.items.length > 0 ? (
                      <div key={group.label}>
                        <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 gap-1.5">
                          {group.items.map((slot) => {
                            const selected = draft.time24 === slot.time24;
                            return (
                              <button
                                key={slot.time24}
                                type="button"
                                disabled={!slot.available}
                                onClick={() => {
                                  setDraft((prev) => ({
                                    ...prev,
                                    time24: slot.time24,
                                  }));
                                  if (errors.time24) {
                                    setErrors((prev) => ({
                                      ...prev,
                                      time24: '',
                                    }));
                                  }
                                }}
                                aria-pressed={selected}
                                className={`rounded-md border px-2 py-1.5 text-xs font-mono tabular-nums font-medium transition-colors min-h-[36px] whitespace-nowrap ${
                                  !slot.available
                                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-600'
                                    : selected
                                      ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-500 dark:text-slate-950'
                                      : 'border-slate-200 bg-white text-slate-800 hover:border-teal-600 hover:text-teal-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-teal-400 dark:hover:text-teal-300'
                                }`}
                              >
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {errors.time24 ? (
                <p
                  role="alert"
                  className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-400"
                >
                  {errors.time24}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* STEP 5: REASON FOR VISIT (Single Column) */}
        {step === 5 ? (
          <div data-testid="reason-single-col" className="space-y-4">
            <div>
              <label
                htmlFor="book-reason-notes"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Reason for Visit
              </label>
              <textarea
                id="book-reason-notes"
                rows={3}
                value={draft.reasonForVisit}
                aria-required="true"
                aria-invalid={Boolean(errors.reasonForVisit)}
                aria-describedby={
                  errors.reasonForVisit ? 'book-reason-err' : undefined
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setDraft((prev) => ({
                    ...prev,
                    reasonForVisit: value,
                  }));
                  if (errors.reasonForVisit && value.trim()) {
                    setErrors((prev) => ({
                      ...prev,
                      reasonForVisit: '',
                    }));
                  }
                }}
                placeholder="Describe your symptoms, follow-up need, or tap a common reason below..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {errors.reasonForVisit ? (
                <p
                  id="book-reason-err"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-rose-700 dark:text-rose-400"
                >
                  {errors.reasonForVisit}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Common reasons (tap to add)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {getCommonVisitReasons(clinic, draft.appointmentTypeId).map(
                  (reason) => {
                    const selected = isReasonSelected(
                      draft.reasonForVisit,
                      reason
                    );
                    return (
                      <button
                        key={reason}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const nextReason = toggleVisitReason(
                            draft.reasonForVisit,
                            reason
                          );
                          setDraft((prev) => ({
                            ...prev,
                            reasonForVisit: nextReason,
                          }));
                          if (errors.reasonForVisit && nextReason.trim()) {
                            setErrors((prev) => ({
                              ...prev,
                              reasonForVisit: '',
                            }));
                          }
                        }}
                        className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-3 py-1.5 text-left text-xs font-medium whitespace-normal transition-colors min-h-[36px] ${
                          selected
                            ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/60 dark:text-teal-100'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-600 hover:bg-teal-50/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-teal-400'
                        }`}
                      >
                        {selected ? (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300"
                            aria-hidden="true"
                          />
                        ) : (
                          <Plus
                            className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                            aria-hidden="true"
                          />
                        )}
                        <span>{reason}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* STEP 6: REVIEW & CONFIRM (Single Column) */}
        {step === 6 ? (
          <div data-testid="review-single-col" className="min-w-0 space-y-4">
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Patient
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  {draft.patientName}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Location
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100 sm:text-right">
                  <MapPin
                    className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{selectedLocation?.name}</span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Visit Type
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  {selectedType?.name} ({selectedType?.durationMinutes} min)
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Specialist
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                  <User
                    className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {resolvedProvider
                      ? `${resolvedProvider.name}, ${resolvedProvider.credentials}`
                      : 'Specialist not selected'}
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Date &amp; Time
                </span>
                <span className="inline-flex flex-wrap items-center gap-1.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  <Calendar
                    className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{formatDateLabel(draft.date)}</span>
                  <Clock
                    className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 ml-1"
                    aria-hidden="true"
                  />
                  <span>{formatTime12h(draft.time24)}</span>
                </span>
              </div>
              {draft.reasonForVisit ? (
                <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-slate-500 dark:text-slate-400">
                    Reason for Visit
                  </span>
                  <span className="text-slate-900 dark:text-slate-100 sm:text-right">
                    {draft.reasonForVisit}
                  </span>
                </div>
              ) : null}
            </div>



            <p className="text-xs text-slate-500 dark:text-slate-400">
              You can reschedule or cancel this appointment online up to{' '}
              {clinic.cancellationPolicyHours} hours before your visit.
            </p>
          </div>
        ) : null}

        {submitError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
          >
            {submitError}
          </p>
        ) : null}
      </div>

      {/* Clean Step Footer: Previous always Left, Continue / Confirm always Right */}
      <div
        data-testid="booking-step-footer"
        className={`flex flex-nowrap items-center gap-2 sm:gap-3 border-t border-slate-200 px-4 py-3 sm:px-6 dark:border-slate-800 ${
          step > 1 ? 'justify-between' : 'justify-end'
        }`}
      >
        {step > 1 ? (
          <button
            type="button"
            disabled={submitting}
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Previous<span className="hidden sm:inline"> Step</span>
            </span>
          </button>
        ) : null}

        {step < STEPS.length ? (
          <button
            type="button"
            disabled={step === 4 && loadingSlots}
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-xs sm:px-5 sm:text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <span>Continue</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            aria-busy={submitting}
            onClick={handleConfirmBooking}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-xs sm:px-6 sm:text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : null}
            <span>
              {submitting ? (
                'Confirming...'
              ) : (
                <>
                  Confirm<span className="hidden sm:inline"> Appointment</span>
                </>
              )}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
