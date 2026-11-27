import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Stethoscope,
  User,
  XCircle,
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
  formatDateWithWeekday,
  formatLocationFullAddress,
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
  getVisibleBookingStepNumbers,
  isReasonSelected,
  resolveProviderForBooking,
  toggleVisitReason,
  validateBookingStep,
} from '../utils/appointments';
import { REFERENCE_TODAY_ISO } from '../data/seedClinicData';
import { CalendarSlotPicker } from './CalendarSlotPicker';
import { BookingWizardSkeleton } from './PortalSkeletons';

interface BookingWizardProps {
  clinic: ClinicProfile;
  providers: Provider[];
  appointmentTypes: AppointmentType[];
  patient: PatientProfile;
  patientKind?: 'established' | 'new' | null;
  appointments: Appointment[];
  loading?: boolean;
  initialAppointmentTypeId?: string;
  onSubmitBooking: (
    draft: BookingDraft
  ) => Promise<Appointment>;
  onFinishToAppointments: () => void;
  onUnsavedProgressChange?: (dirty: boolean) => void;
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

export function BookingWizard({
  clinic,
  providers,
  appointmentTypes,
  patient,
  patientKind,
  appointments,
  loading = false,
  initialAppointmentTypeId,
  onSubmitBooking,
  onFinishToAppointments,
  onUnsavedProgressChange,
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

  const [draft, setDraft] = useState<BookingDraft>(() => {
    const initialLocationId = clinic.locations[0]?.id || '';
    const initialTypes = getApplicableAppointmentTypes(
      appointmentTypes,
      patientKind,
      initialLocationId
    );
    const initialProviders = getEligibleProviders(providers, initialLocationId);
    const preferredTypeId =
      initialAppointmentTypeId &&
      initialTypes.some((t) => t.id === initialAppointmentTypeId)
        ? initialAppointmentTypeId
        : initialTypes[0]?.id || '';
    return {
      appointmentTypeId: preferredTypeId,
      visitMode: 'in-person',
      locationId: initialLocationId,
      providerId: initialProviders[0]?.id || '',
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

  const activeLocationId = draft.locationId || clinic.locations[0]?.id || '';
  const applicableAppointmentTypes = getApplicableAppointmentTypes(
    appointmentTypes,
    patientKind,
    activeLocationId
  );
  const eligibleProviders = getEligibleProviders(providers, activeLocationId);
  const visibleStepNumbers = getVisibleBookingStepNumbers({
    locationsCount: clinic.locations.length,
    appointmentTypesCount: applicableAppointmentTypes.length,
    providersCount: eligibleProviders.length,
  });
  const visibleSteps = STEPS.filter((s) => visibleStepNumbers.includes(s.num));

  const [step, setStep] = useState<number>(() => visibleStepNumbers[0] ?? 4);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [failedBookingError, setFailedBookingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] =
    useState<Appointment | null>(null);
  const didMountScrollRef = useRef(false);

  const initialVisibleStep = visibleStepNumbers[0] ?? 4;
  const hasUnsavedProgress = Boolean(
    !confirmedAppointment &&
      !failedBookingError &&
      (draft.time24 ||
        draft.reasonForVisit.trim() ||
        draft.accommodations.length > 0 ||
        step !== initialVisibleStep)
  );

  useEffect(() => {
    onUnsavedProgressChange?.(hasUnsavedProgress);
  }, [hasUnsavedProgress, onUnsavedProgressChange]);

  useEffect(() => {
    return () => {
      onUnsavedProgressChange?.(false);
    };
  }, [onUnsavedProgressChange]);

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
  }, [step, confirmedAppointment, failedBookingError]);

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
      const eligible = applicableAppointmentTypes.some(
        (t) => t.id === initialAppointmentTypeId
      );
      if (eligible) {
        setDraft((prev) => ({
          ...prev,
          appointmentTypeId: initialAppointmentTypeId,
        }));
      }
    }
  }, [initialAppointmentTypeId, applicableAppointmentTypes]);

  // Keep location, visit type, specialist, and visible step in sync when single-option steps auto-skip
  useEffect(() => {
    setDraft((prev) => {
      const nextLocId =
        clinic.locations.length === 1
          ? clinic.locations[0]?.id || ''
          : clinic.locations.some((l) => l.id === prev.locationId)
            ? prev.locationId
            : clinic.locations[0]?.id || '';

      const nextTypes = getApplicableAppointmentTypes(
        appointmentTypes,
        patientKind,
        nextLocId
      );
      const nextTypeId =
        nextTypes.length === 1
          ? nextTypes[0]?.id || ''
          : nextTypes.some((t) => t.id === prev.appointmentTypeId)
            ? prev.appointmentTypeId
            : nextTypes[0]?.id || '';

      const nextProviders = getEligibleProviders(providers, nextLocId);
      const nextProviderId =
        nextProviders.length === 1
          ? nextProviders[0]?.id || ''
          : nextProviders.some((p) => p.id === prev.providerId)
            ? prev.providerId
            : nextProviders[0]?.id || '';

      if (
        nextLocId === prev.locationId &&
        nextTypeId === prev.appointmentTypeId &&
        nextProviderId === prev.providerId
      ) {
        return prev;
      }
      return {
        ...prev,
        locationId: nextLocId,
        appointmentTypeId: nextTypeId,
        providerId: nextProviderId,
        time24: nextProviderId === prev.providerId ? prev.time24 : '',
      };
    });
  }, [clinic.locations, appointmentTypes, providers, patientKind]);

  useEffect(() => {
    if (!visibleStepNumbers.includes(step)) {
      const nextValid =
        visibleStepNumbers.find((n) => n >= step) ?? visibleStepNumbers[0] ?? 4;
      setStep(nextValid);
    }
  }, [step, visibleStepNumbers]);

  const selectedType =
    applicableAppointmentTypes.find((t) => t.id === draft.appointmentTypeId) ||
    appointmentTypes.find((t) => t.id === draft.appointmentTypeId);

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

  const currentVisibleIdx = Math.max(
    0,
    visibleSteps.findIndex((s) => s.num === step)
  );

  const handleNext = () => {
    const stepErrors = validateBookingStep(step, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      if (step === 5 && stepErrors.reasonForVisit) {
        window.requestAnimationFrame(() => {
          document.getElementById('book-reason-notes')?.focus();
        });
      }
      return;
    }
    setErrors({});
    const nextStep = visibleSteps[currentVisibleIdx + 1]?.num ?? 6;
    setStep(nextStep);
  };

  const handleBack = () => {
    setErrors({});
    setSubmitError('');
    const prevStep =
      visibleSteps[Math.max(0, currentVisibleIdx - 1)]?.num ??
      visibleSteps[0]?.num ??
      4;
    setStep(prevStep);
  };

  const handleConfirmBooking = async () => {
    const allErrors = validateBookingStep(6, draft);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setFailedBookingError(null);
    try {
      const created = await onSubmitBooking(draft);
      if (!created || created.status === 'cancelled') {
        setFailedBookingError(
          'Your appointment could not be confirmed. Please choose another time slot or try again.'
        );
        return;
      }
      setConfirmedAppointment(created);
    } catch (err) {
      setFailedBookingError(
        err instanceof Error
          ? err.message
          : 'Could not complete booking. Please check your time slot and try again.'
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

  const currentStepMeta = STEPS[step - 1] || STEPS[0];

  const selectedLocationFullAddress = formatLocationFullAddress(selectedLocation);

  if (loading) {
    return <BookingWizardSkeleton />;
  }

  if (failedBookingError) {
    return (
      <section
        aria-labelledby="booking-unconfirmed-title"
        data-testid="booking-unconfirmed-view"
        className="flex flex-1 flex-col justify-between w-full min-w-0 overflow-hidden rounded-xl border border-rose-200 bg-white p-3.5 sm:p-6 dark:border-rose-900/70 dark:bg-slate-900"
      >
        <div
          role="alert"
          className="flex flex-col items-center text-center border-b border-rose-100 pb-2.5 sm:pb-4 dark:border-rose-900/50"
        >
          <div
            data-testid="unconfirmed-error-icon"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
          >
            <XCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1
            id="booking-unconfirmed-title"
            className="mt-2 sm:mt-2.5 font-display text-lg sm:text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-300"
          >
            Appointment Not Confirmed
          </h1>
          <p className="mt-1 max-w-lg text-xs sm:text-sm text-rose-800 dark:text-rose-200">
            {failedBookingError}
          </p>
        </div>

        <div className="my-auto py-2.5 sm:py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="divide-y divide-slate-200 px-3.5 sm:px-4 dark:divide-slate-800">
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Patient
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  {draft.patientName}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Visit Type
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  {selectedType?.name}
                  {selectedType?.durationMinutes
                    ? ` (${selectedType.durationMinutes} min)`
                    : ''}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-200 px-3.5 sm:px-4 dark:divide-slate-800">
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Requested Time
                </span>
                <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 sm:justify-end">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Calendar
                      className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="break-words">{formatDateWithWeekday(draft.date)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Clock
                      className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{formatTime12h(draft.time24)}</span>
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  Location
                </span>
                <div className="min-w-0 sm:text-right">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <MapPin
                      className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{selectedLocation?.name}</span>
                  </span>
                  {selectedLocationFullAddress ? (
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 break-words">
                      {selectedLocationFullAddress}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-t border-slate-200 pt-2.5 sm:pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setFailedBookingError(null);
              setStep(6);
            }}
            className="inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Back to Review</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFailedBookingError(null);
              setDraft((prev) => ({ ...prev, time24: '' }));
              setStep(4);
            }}
            className="inline-flex max-w-full items-center justify-center rounded-lg bg-rose-700 px-3.5 py-2 text-xs sm:px-5 sm:text-sm font-semibold text-white hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 min-h-[40px]"
          >
            Choose Another Time
          </button>
        </div>
      </section>
    );
  }

  if (confirmedAppointment) {
    const confirmedLocation = clinic.locations.find(
      (l) => l.id === confirmedAppointment.locationId
    );
    const confirmedFullAddress =
      confirmedAppointment.locationAddress ||
      formatLocationFullAddress(confirmedLocation);

    return (
      <section
        aria-labelledby="booking-confirmed-title"
        data-testid="booking-confirmed-view"
        className="flex flex-1 flex-col justify-between w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          role="status"
          className="flex flex-col items-center text-center border-b border-slate-200 pb-2.5 sm:pb-4 dark:border-slate-800"
        >
          <div
            data-testid="confirmed-brand-tick"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-brand-primary text-brand-fg shadow-xs"
          >
            <Check className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
          </div>
          <h1
            id="booking-confirmed-title"
            className="mt-2 sm:mt-2.5 font-display text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
          >
            Appointment Confirmed
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            Scheduled for{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {formatDateWithWeekday(confirmedAppointment.date)}
            </span>{' '}
            at{' '}
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatTime12h(confirmedAppointment.time24)}
            </span>
          </p>
          {confirmedAppointment.confirmationCode ? (
            <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              Confirmation #{confirmedAppointment.confirmationCode}
            </p>
          ) : null}
        </div>

        <div
          data-testid="confirmed-single-col"
          className="my-auto space-y-2.5 sm:space-y-3 py-2.5 sm:py-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="divide-y divide-slate-200 px-3.5 sm:px-4 dark:divide-slate-800">
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Patient
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  {confirmedAppointment.patientName}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Visit Type
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  {confirmedAppointment.appointmentTypeName} (
                  {confirmedAppointment.durationMinutes} min)
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Specialist
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  <User
                    className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {confirmedAppointment.providerName},{' '}
                    {confirmedAppointment.providerCredentials}
                  </span>
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-200 px-3.5 sm:px-4 dark:divide-slate-800">
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Date &amp; Time
                </span>
                <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 sm:justify-end">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Calendar
                      className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                      aria-hidden="true"
                    />
                    <span className="break-words">{formatDateWithWeekday(confirmedAppointment.date)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Clock
                      className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{formatTime12h(confirmedAppointment.time24)}</span>
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  Location
                </span>
                <div className="min-w-0 sm:text-right">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <MapPin
                      className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                      aria-hidden="true"
                    />
                    <span>{confirmedAppointment.locationName}</span>
                  </span>
                  {confirmedFullAddress ? (
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 break-words">
                      {confirmedFullAddress}
                    </p>
                  ) : null}
                </div>
              </div>
              {confirmedAppointment.reasonForVisit ? (
                <div className="flex flex-col gap-0.5 py-2 sm:py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-slate-500 dark:text-slate-400">
                    Reason for Visit
                  </span>
                  <span className="text-slate-900 dark:text-slate-100 sm:text-right break-words">
                    {confirmedAppointment.reasonForVisit}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {clinic.bookingNote ? (
            <p
              data-testid="confirmed-clinic-note"
              className="rounded-lg border border-brand-soft-border bg-brand-soft-bg px-3.5 py-2 text-xs leading-relaxed text-slate-800 dark:border-brand-soft-border-dark dark:bg-brand-soft-bg-dark dark:text-slate-100"
            >
              <span className="font-semibold text-brand-text dark:text-brand-text-dark">
                Note:{' '}
              </span>
              {clinic.bookingNote}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-t border-slate-200 pt-2.5 sm:pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleDownloadIcs(confirmedAppointment)}
            className="inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">Calendar (.ics)</span>
            <span className="hidden sm:inline">Add to Calendar (.ics)</span>
          </button>

          <button
            type="button"
            onClick={onFinishToAppointments}
            className="inline-flex max-w-full items-center justify-center rounded-lg bg-brand-primary px-3.5 py-2 text-xs sm:px-5 sm:text-sm font-semibold text-brand-fg hover:bg-brand-hover min-h-[40px]"
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
      className="flex flex-1 flex-col justify-between w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Compact Header with Dynamic Brand-Colored Icon Node Timeline */}
      <div className="border-b border-slate-200 px-3.5 py-3 sm:px-6 sm:py-3.5 dark:border-slate-800">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-brand-text dark:text-brand-text-dark">
            Book an Appointment
          </p>
          <span
            data-testid="booking-step-indicator"
            className="min-w-0 max-w-full font-mono text-[11px] sm:text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400"
          >
            Step {currentVisibleIdx + 1} of {visibleSteps.length}
            <span className="sm:hidden font-sans font-semibold text-brand-text dark:text-brand-text-dark">
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

        {/* Node Timeline with Brand Icons — equal connector spacing across mobile, tablet, and laptop */}
        <nav
          aria-label="Booking progress"
          data-testid="booking-node-timeline"
          className="mt-3 sm:mt-3.5"
        >
          <ol className="flex items-start justify-between sm:pb-5">
            {visibleSteps.map((s, idx) => {
              const Icon = s.icon;
              const isCurrent = step === s.num;
              const isComplete = idx < currentVisibleIdx;
              const isLast = idx === visibleSteps.length - 1;

              return (
                <li
                  key={s.num}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-w-0 items-start ${isLast ? 'shrink-0' : 'flex-1'}`}
                >
                  <div className="relative flex flex-col items-center">
                    <div
                      data-step-node={s.num}
                      className={`relative flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 transition-colors ${
                        isCurrent
                          ? 'border-brand-primary bg-brand-primary text-brand-fg'
                          : isComplete
                            ? 'border-brand-primary bg-brand-soft-bg text-brand-text dark:bg-brand-soft-bg-dark dark:text-brand-text-dark'
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
                          ? 'font-semibold text-brand-text dark:text-brand-text-dark'
                          : isComplete
                            ? 'font-medium text-brand-text dark:text-brand-text-dark'
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
                            ? 'bg-brand-primary'
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
      <div className="flex-1 min-w-0 p-3.5 sm:p-5">
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
                        const nextTypes = getApplicableAppointmentTypes(
                          appointmentTypes,
                          patientKind,
                          loc.id
                        );
                        const currentTypeValid = nextTypes.some(
                          (t) => t.id === prev.appointmentTypeId
                        );
                        return {
                          ...prev,
                          locationId: loc.id,
                          visitMode: 'in-person',
                          appointmentTypeId: currentTypeValid
                            ? prev.appointmentTypeId
                            : nextTypes[0]?.id || '',
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
                        ? 'border-brand-primary bg-brand-soft-bg dark:border-brand-primary dark:bg-brand-soft-bg-dark'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {loc.name}
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-slate-600 dark:text-slate-300">
                        <MapPin
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-text dark:text-brand-text-dark"
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
                          ? 'border-brand-primary bg-brand-primary text-brand-fg'
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

        {/* STEP 2: VISIT TYPE (Strict 2-column grid, filtered to applicable visit types) */}
        {step === 2 ? (
          <div className="min-w-0">
            <div
              data-testid="visit-types-grid"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {applicableAppointmentTypes.map((type) => {
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
                        ? 'border-brand-primary bg-brand-soft-bg dark:border-brand-primary dark:bg-brand-soft-bg-dark'
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
                          ? 'border-brand-primary bg-brand-primary text-brand-fg'
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
                        ? 'border-brand-primary bg-brand-soft-bg dark:border-brand-primary dark:bg-brand-soft-bg-dark'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 font-display text-xs font-bold text-brand-text dark:border-slate-700 dark:bg-slate-800 dark:text-brand-text-dark"
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

        {/* STEP 4: COMPACT 1-MONTH CALENDAR (LEFT) + TIME SLOTS (RIGHT) */}
        {step === 4 ? (
          <CalendarSlotPicker
            activeMonth={activeMonth}
            monthIndex={monthIndex}
            totalMonths={availableMonths.length}
            monthCells={monthCells}
            selectedDate={draft.date}
            selectedTime24={draft.time24}
            slots={slots}
            loadingSlots={loadingSlots}
            getDateSlotCount={getDateSlotCount}
            onMonthNavigate={handleMonthNavigate}
            onSelectDate={(dateIso) => {
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
            }}
            onSelectTime={(time24) => {
              setDraft((prev) => ({
                ...prev,
                time24,
              }));
              if (errors.time24) {
                setErrors((prev) => ({
                  ...prev,
                  time24: '',
                }));
              }
            }}
            dateError={errors.date}
            timeError={errors.time24}
            slotsHeading="Available Times"
            emptySlotsMessage="No open clinic slots on this date. Please select another day on the calendar."
            variant="wizard"
          />
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
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400"
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
                            ? 'border-brand-primary bg-brand-soft-bg text-brand-text dark:border-brand-primary dark:bg-brand-soft-bg-dark dark:text-brand-text-dark'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-primary hover:bg-brand-soft-bg/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-brand-primary'
                        }`}
                      >
                        {selected ? (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-brand-text dark:text-brand-text-dark"
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
              <div className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  Location
                </span>
                <div className="min-w-0 sm:text-right">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <MapPin
                      className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                      aria-hidden="true"
                    />
                    <span>{selectedLocation?.name}</span>
                  </span>
                  {selectedLocationFullAddress ? (
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 break-words">
                      {selectedLocationFullAddress}
                    </p>
                  ) : null}
                </div>
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
                    className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
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
                <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Calendar
                      className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                      aria-hidden="true"
                    />
                    <span className="break-words">{formatDateWithWeekday(draft.date)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Clock
                      className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{formatTime12h(draft.time24)}</span>
                  </span>
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

            {clinic.bookingNote ? (
              <p
                data-testid="review-clinic-note"
                className="rounded-lg border border-brand-soft-border bg-brand-soft-bg px-3.5 py-2.5 text-xs leading-relaxed text-slate-800 dark:border-brand-soft-border-dark dark:bg-brand-soft-bg-dark dark:text-slate-100"
              >
                <span className="font-semibold text-brand-text dark:text-brand-text-dark">
                  Note:{' '}
                </span>
                {clinic.bookingNote}
              </p>
            ) : null}

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
        className={`flex flex-wrap items-center gap-2 sm:gap-3 border-t border-slate-200 px-4 py-3 sm:px-6 dark:border-slate-800 ${
          currentVisibleIdx > 0 ? 'justify-between' : 'justify-end'
        }`}
      >
        {currentVisibleIdx > 0 ? (
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

        {currentVisibleIdx < visibleSteps.length - 1 ? (
          <button
            type="button"
            disabled={step === 4 && loadingSlots}
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-xs sm:px-5 sm:text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 whitespace-nowrap shrink-0 min-h-[40px]"
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
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-xs sm:px-6 sm:text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60 whitespace-nowrap shrink-0 min-h-[40px]"
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
