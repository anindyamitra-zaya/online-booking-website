import { useEffect, useState } from 'react';
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
  Loader2,
  MapPin,
  Plus,
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
  canModifyAppointment,
  filterUpcomingAppointments,
  formatDateLabel,
  formatShortDate,
  formatTime12h,
  generateAvailableSlots,
  generateIcsContent,
  getBookableDates,
  getCommonVisitReasons,
  getProviderInitials,
  isReasonSelected,
  resolveProviderForBooking,
  toggleVisitReason,
  validateBookingStep,
} from '../utils/appointments';
import { REFERENCE_TODAY_ISO } from '../data/seedClinicData';
import { StatusLabel } from './StatusLabel';

interface BookingWizardProps {
  clinic: ClinicProfile;
  providers: Provider[];
  appointmentTypes: AppointmentType[];
  patient: PatientProfile;
  appointments: Appointment[];
  loadingAppointments: boolean;
  initialAppointmentTypeId?: string;
  onSubmitBooking: (draft: BookingDraft) => Promise<Appointment>;
  onFinishToAppointments: () => void;
  onOpenReschedule: (appointment: Appointment) => void;
  onOpenCancel: (appointment: Appointment) => void;
}

const STEPS = [
  { num: 1, title: 'Location & Visit' },
  { num: 2, title: 'Specialist & Time' },
  { num: 3, title: 'Review & Confirm' },
];

export function BookingWizard({
  clinic,
  providers,
  appointmentTypes,
  patient,
  appointments,
  loadingAppointments,
  initialAppointmentTypeId,
  onSubmitBooking,
  onFinishToAppointments,
  onOpenReschedule,
  onOpenCancel,
}: BookingWizardProps) {
  const bookableDates = getBookableDates(REFERENCE_TODAY_ISO, 90);
  const CHUNK_SIZE = 14;
  const [dateChunkIndex, setDateChunkIndex] = useState(0);
  const currentChunkDates = bookableDates.slice(
    dateChunkIndex * CHUNK_SIZE,
    (dateChunkIndex + 1) * CHUNK_SIZE
  );
  const getDateSlotCount = (dateIso: string) => {
    const generated = generateAvailableSlots(dateIso, draft.providerId || 'any', appointments);
    return generated.length;
  };
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<BookingDraft>(() => ({
    appointmentTypeId:
      initialAppointmentTypeId || appointmentTypes[0]?.id || '',
    visitMode: 'in-person',
    locationId: clinic.locations[0]?.id || '',
    providerId: 'any',
    date: bookableDates[0] || REFERENCE_TODAY_ISO,
    time24: '',
    patientName: patient.fullName,
    dateOfBirth: patient.dateOfBirth,
    patientPhone: patient.phone,
    patientEmail: patient.email || '',
    reasonForVisit: '',
    accommodations: [],
  }));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] =
    useState<Appointment | null>(null);

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

  const eligibleProviders = providers.filter((p) =>
    draft.locationId ? p.locationIds.includes(draft.locationId) : true
  );

  const upcomingAppointments = filterUpcomingAppointments(
    appointments,
    '',
    REFERENCE_TODAY_ISO
  );

  // Load live available slots when in Step 2 (Specialist & Time)
  useEffect(() => {
    if (step !== 2 || !draft.date) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSubmitError('');

    fetchAvailability({
      date: draft.date,
      providerId: draft.providerId || 'any',
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
  }, [step, draft.date, draft.providerId]);

  const handleNext = () => {
    const stepErrors = validateBookingStep(step, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((prev) => Math.min(3, prev + 1));
  };

  const handleBack = () => {
    setErrors({});
    setSubmitError('');
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleConfirmBooking = async () => {
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

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
      {/* Left Card: Unified Booking Card with Integrated Header & Footer */}
      <div className="lg:col-span-8 flex flex-col">
        {confirmedAppointment ? (
          <section
            aria-labelledby="booking-confirmed-title"
            className="flex flex-1 flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
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

              <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Patient
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmedAppointment.patientName}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Visit Type
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {confirmedAppointment.appointmentTypeName} (
                    {confirmedAppointment.durationMinutes} min)
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Specialist
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <User className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                    <span>
                      {confirmedAppointment.providerName},{' '}
                      {confirmedAppointment.providerCredentials}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Date &amp; Time
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    <Calendar className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                    <span>{formatDateLabel(confirmedAppointment.date)}</span>
                    <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0 ml-1" aria-hidden="true" />
                    <span>{formatTime12h(confirmedAppointment.time24)}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Location
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-right font-medium text-slate-900 dark:text-slate-100">
                    <MapPin className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                    <span>{confirmedAppointment.locationName}</span>
                  </span>
                </div>
              </div>

              {confirmedAppointment.preparationInstructions.length > 0 ? (
                <div className="mt-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                    Before your visit
                  </h2>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
                    {confirmedAppointment.preparationInstructions.map(
                      (note, idx) => (
                        <li key={idx}>{note}</li>
                      )
                    )}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDownloadIcs(confirmedAppointment)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Add to Calendar (.ics)</span>
              </button>

              <button
                type="button"
                onClick={onFinishToAppointments}
                className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 min-h-[40px]"
              >
                View My Appointments
              </button>
            </div>
          </section>
        ) : (
          <section
            aria-labelledby="book-wizard-heading"
            className="flex flex-1 flex-col justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Unified Card Header aligned with Sidebar Header */}
            <div className="flex flex-col gap-2.5 border-b border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <h1
                id="book-wizard-heading"
                className="font-display text-base font-bold text-slate-900 dark:text-slate-50 whitespace-nowrap"
              >
                Book an Appointment
              </h1>

              <nav aria-label="Booking progress">
                <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {STEPS.map((s) => {
                    const isCurrent = step === s.num;
                    const isComplete = step > s.num;
                    return (
                      <li
                        key={s.num}
                        aria-current={isCurrent ? 'step' : undefined}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
                          isCurrent
                            ? 'font-semibold text-teal-700 dark:text-teal-300'
                            : isComplete
                              ? 'font-medium text-slate-700 dark:text-slate-200'
                              : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-mono font-semibold ${
                            isCurrent
                              ? 'bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950'
                              : isComplete
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {isComplete ? (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            s.num
                          )}
                        </span>
                        <span>{s.title}</span>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>

            {/* Step Body */}
            <div className="flex-1 p-4 sm:px-5 sm:py-4">
              {/* STEP 1: LOCATION & VISIT TYPE (IN-PERSON) */}
              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      1. Clinic Location
                    </h2>
                    <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
                      {clinic.locations.map((loc) => {
                        const selected = draft.locationId === loc.id;
                        return (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                locationId: loc.id,
                                visitMode: 'in-person',
                              }))
                            }
                            aria-pressed={selected}
                            aria-label={`${loc.name}, ${loc.address}, ${loc.cityStateZip}`}
                            className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                              selected
                                ? 'border-teal-700 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/40'
                                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                            }`}
                          >
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                              {loc.name}
                            </p>
                            <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-300">
                              {loc.address}, {loc.cityStateZip}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    {errors.locationId ? (
                      <p
                        role="alert"
                        className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                      >
                        {errors.locationId}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Visit Type (In-Person)
                    </h3>
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                      {appointmentTypes.map((type) => {
                        const selected = draft.appointmentTypeId === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                appointmentTypeId: type.id,
                              }))
                            }
                            aria-pressed={selected}
                            className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2 text-left transition-colors ${
                              selected
                                ? 'border-teal-700 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/40'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600 dark:hover:bg-slate-900'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
                                  {type.name}
                                </span>
                                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                                  {type.durationMinutes} min
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-xs text-slate-600 dark:text-slate-300">
                                {type.description}
                              </p>
                            </div>
                            <span
                              aria-hidden="true"
                              className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
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
                        className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                      >
                        {errors.appointmentTypeId}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* STEP 2: SPECIALIST & TIME */}
              {step === 2 ? (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      2. Specialist
                    </h2>
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, providerId: 'any' }))
                        }
                        aria-pressed={draft.providerId === 'any'}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors min-h-[44px] ${
                          draft.providerId === 'any'
                            ? 'border-teal-700 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/40'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-teal-700 dark:bg-slate-800 dark:text-teal-300">
                          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-900 dark:text-slate-50">
                            First Available Specialist
                          </span>
                          <span className="block truncate text-[11px] text-slate-600 dark:text-slate-300">
                            Fastest open slot
                          </span>
                        </div>
                      </button>

                      {eligibleProviders.map((prov) => {
                        const selected = draft.providerId === prov.id;
                        return (
                          <button
                            key={prov.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                providerId: prov.id,
                              }))
                            }
                            aria-pressed={selected}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors min-h-[44px] ${
                              selected
                                ? 'border-teal-700 bg-teal-50/60 dark:border-teal-400 dark:bg-teal-950/40'
                                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                            }`}
                          >
                            <div
                              aria-hidden="true"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 font-display text-[11px] font-bold text-teal-800 dark:border-slate-700 dark:bg-slate-800 dark:text-teal-300"
                            >
                              {getProviderInitials(prov.name)}
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-slate-900 dark:text-slate-50">
                                {prov.name}, {prov.credentials}
                              </span>
                              <span className="block truncate text-[11px] text-slate-600 dark:text-slate-300">
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
                        className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                      >
                        {errors.providerId}
                      </p>
                    ) : null}
                  </div>

                   <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Select Date (2-Week Schedule)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={dateChunkIndex === 0}
                          onClick={() => setDateChunkIndex((prev) => Math.max(0, prev - 1))}
                          aria-label="Previous 2 weeks"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={(dateChunkIndex + 1) * CHUNK_SIZE >= bookableDates.length}
                          onClick={() => setDateChunkIndex((prev) => prev + 1)}
                          aria-label="Next 2 weeks"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                      {currentChunkDates.map((dateIso) => {
                        const { weekday, monthDay } = formatShortDate(dateIso);
                        const selected = draft.date === dateIso;
                        const count = getDateSlotCount(dateIso);
                        const isFullyBooked = count === 0;

                        return (
                          <button
                            key={dateIso}
                            type="button"
                            disabled={isFullyBooked}
                            onClick={() => {
                              if (!isFullyBooked) {
                                setDraft((prev) => ({
                                  ...prev,
                                  date: dateIso,
                                  time24: '',
                                }));
                              }
                            }}
                            aria-pressed={selected}
                            className={`relative flex flex-col items-center justify-center rounded-lg border px-1 py-1 transition-colors min-h-[46px] ${
                              isFullyBooked
                                ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-600'
                                : selected
                                  ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-500 dark:text-slate-950'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-teal-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-teal-400 dark:hover:bg-slate-900'
                            }`}
                          >
                            <span className="text-[10px] font-medium uppercase leading-none opacity-80">
                              {weekday}
                            </span>
                            <span className="mt-0.5 text-xs font-semibold tabular-nums leading-tight">
                              {monthDay}
                            </span>
                            {count > 0 ? (
                              <span
                                className={`mt-0.5 rounded px-1.5 font-mono text-[9px] font-semibold tabular-nums leading-none ${
                                  selected
                                    ? 'bg-teal-900/30 text-white dark:bg-slate-950/30 dark:text-slate-950'
                                    : 'bg-teal-50 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300'
                                }`}
                              >
                                {count}
                              </span>
                            ) : (
                              <span className="mt-0.5 h-[13px]" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {errors.date ? (
                      <p
                        role="alert"
                        className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                      >
                        {errors.date}
                      </p>
                    ) : null}
                  </div>

                  <div aria-busy={loadingSlots}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Available Times
                      </span>
                      {loadingSlots ? (
                        <span
                          role="status"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-300"
                        >
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                          <span>Checking open times...</span>
                        </span>
                      ) : null}
                    </div>
                    {loadingSlots ? (
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                          />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        No open clinic slots on this date. Please select another
                        day.
                      </p>
                    ) : (
                      <div className="mt-1.5 grid gap-3 md:grid-cols-2">
                        {[
                          { label: 'Morning', items: morningSlots },
                          { label: 'Afternoon', items: afternoonSlots },
                        ].map((group) =>
                          group.items.length > 0 ? (
                            <div key={group.label}>
                              <p className="mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {group.label}
                              </p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {group.items.map((slot) => {
                                  const selected = draft.time24 === slot.time24;
                                  return (
                                    <button
                                      key={slot.time24}
                                      type="button"
                                      disabled={!slot.available}
                                      onClick={() =>
                                        setDraft((prev) => ({
                                          ...prev,
                                          time24: slot.time24,
                                        }))
                                      }
                                      aria-pressed={selected}
                                      className={`rounded-lg border px-2 py-1 text-xs font-mono tabular-nums font-medium transition-colors min-h-[34px] ${
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
                        className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                      >
                        {errors.time24}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2 border-t border-slate-200 pt-2.5 dark:border-slate-800">
                    <div>
                      <label
                        htmlFor="book-reason-notes"
                        className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        Reason for Visit
                      </label>
                      <input
                        id="book-reason-notes"
                        type="text"
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
                        placeholder="Describe symptoms, follow-up need, or tap a common reason below..."
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 min-h-[38px]"
                      />
                      {errors.reasonForVisit ? (
                        <p
                          id="book-reason-err"
                          role="alert"
                          className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                        >
                          {errors.reasonForVisit}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Common reasons (tap to add):
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {getCommonVisitReasons(
                          clinic,
                          draft.appointmentTypeId
                        ).map((reason) => {
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
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors min-h-[30px] ${
                                selected
                                  ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/60 dark:text-teal-100'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-600 hover:bg-teal-50/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-teal-400'
                              }`}
                            >
                              {selected ? (
                                <Check
                                  className="h-3 w-3 shrink-0 text-teal-700 dark:text-teal-300"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Plus
                                  className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{reason}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* STEP 3: REVIEW & CONFIRM */}
              {step === 3 ? (
                <div className="space-y-3.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    3. Review &amp; Confirm Appointment
                  </h2>

                  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Patient
                      </span>
                      <span className="text-right font-medium text-slate-900 dark:text-slate-100">
                        {draft.patientName} ·{' '}
                        <span className="font-mono tabular-nums">
                          {draft.patientPhone}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Visit Type
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {selectedType?.name} ({selectedType?.durationMinutes}{' '}
                        min)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Specialist
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                        <User className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                        <span>
                          {resolvedProvider
                            ? `${resolvedProvider.name}, ${resolvedProvider.credentials}`
                            : 'Assigned Specialist'}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Date &amp; Time
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Location
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-right font-medium text-slate-900 dark:text-slate-100">
                        <MapPin className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                        <span>
                          {selectedLocation
                            ? `${selectedLocation.name} (${selectedLocation.address})`
                            : ''}
                        </span>
                      </span>
                    </div>
                    {draft.reasonForVisit ? (
                      <div className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          Reason for Visit
                        </span>
                        <span className="text-right text-slate-900 dark:text-slate-100">
                          {draft.reasonForVisit}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {selectedType &&
                  selectedType.preparationInstructions.length > 0 ? (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                        Preparation Notes
                      </h3>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
                        {selectedType.preparationInstructions.map(
                          (note, idx) => (
                            <li key={idx}>{note}</li>
                          )
                        )}
                      </ul>
                    </div>
                  ) : null}

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    You can reschedule or cancel this appointment online anytime
                    up to {clinic.cancellationPolicyHours} hours before your
                    visit.
                  </p>
                </div>
              ) : null}

              {submitError ? (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
                >
                  {submitError}
                </p>
              ) : null}
            </div>

            {/* Wizard Footer Controls (No Cancel button) */}
            <div
              className={`flex items-center gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800 ${
                step > 1 ? 'justify-between' : 'justify-end'
              }`}
            >
              {step > 1 ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 min-h-[38px]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Previous Step</span>
                </button>
              ) : null}

              {step < 3 ? (
                <button
                  type="button"
                  disabled={step === 2 && loadingSlots}
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 min-h-[38px]"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  aria-busy={submitting}
                  onClick={handleConfirmBooking}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-6 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 min-h-[38px]"
                >
                  {submitting ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>
                    {submitting
                      ? 'Confirming Appointment...'
                      : 'Confirm Appointment'}
                  </span>
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Right Card: Aligned Upcoming Appointments Sidebar */}
      <aside
        aria-labelledby="booking-upcoming-heading"
        className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2
            id="booking-upcoming-heading"
            className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-slate-50"
          >
            <span>Upcoming Visits</span>
            <span
              data-testid="sidebar-upcoming-count"
              className="inline-flex min-w-[22px] items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-teal-800 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-200"
            >
              {upcomingAppointments.length}
            </span>
          </h2>
          {upcomingAppointments.length > 0 ? (
            <button
              type="button"
              onClick={onFinishToAppointments}
              className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300 whitespace-nowrap"
            >
              View All
            </button>
          ) : null}
        </div>

        {loadingAppointments ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="space-y-2 p-4">
                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-36 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
            ))}
          </div>
        ) : upcomingAppointments.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No upcoming appointments
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Select a clinic location, visit type, and open time to schedule
              your next in-person appointment.
            </p>
          </div>
        ) : (
          <ul
            data-testid="booking-upcoming-list"
            className="divide-y divide-slate-200 dark:divide-slate-800 lg:max-h-[470px] lg:overflow-y-auto"
          >
            {upcomingAppointments.map((appt, idx) => {
              const modifiable = canModifyAppointment(
                appt,
                REFERENCE_TODAY_ISO
              );
              return (
                <li key={appt.id} className="px-4 py-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      <Calendar className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                      <span>{formatDateLabel(appt.date)}</span>
                      <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0 ml-1" aria-hidden="true" />
                      <span>{formatTime12h(appt.time24)}</span>
                    </span>
                    <StatusLabel status={appt.status} />
                  </div>

                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 leading-snug">
                    {appt.appointmentTypeName}
                  </p>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{appt.providerName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{appt.locationName}</span>
                    </div>
                  </div>

                  {modifiable ? (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenReschedule(appt)}
                        className="rounded-md border border-teal-700/80 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-500/80 dark:text-teal-300 dark:hover:bg-teal-950/50 min-h-[30px]"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCancel(appt)}
                        className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/50 min-h-[30px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
