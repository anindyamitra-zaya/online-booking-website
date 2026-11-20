import { useEffect, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  MapPin,
  User,
  X,
} from 'lucide-react';
import type {
  Appointment,
  ClinicProfile,
  Provider,
  TimeSlot,
  VisitMode,
} from '../types/clinic';
import { fetchAvailability } from '../services/clinicApi';
import {
  formatDateLabel,
  formatShortDate,
  formatTime12h,
  generateAvailableSlots,
  getBookableDates,
  getReschedulePolicy,
  resolveRescheduleTargets,
} from '../utils/appointments';
import { REFERENCE_TODAY_ISO } from '../data/seedClinicData';
import { ThemedSelect } from './ThemedSelect';

interface RescheduleModalProps {
  appointment: Appointment | null;
  clinic: ClinicProfile;
  providers: Provider[];
  appointments?: Appointment[];
  onClose: () => void;
  onConfirm: (
    appointmentId: string,
    payload: {
      date: string;
      time24: string;
      providerId: string;
      locationId: string;
      visitMode: VisitMode;
    }
  ) => Promise<void>;
}

export function RescheduleModal({
  appointment,
  clinic,
  providers,
  appointments = [],
  onClose,
  onConfirm,
}: RescheduleModalProps) {
  const bookableDates = getBookableDates(REFERENCE_TODAY_ISO, 90);
  const CHUNK_SIZE = 14;
  const [dateChunkIndex, setDateChunkIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(
    bookableDates[0] || REFERENCE_TODAY_ISO
  );
  const [selectedTime24, setSelectedTime24] = useState<string>('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    clinic.locations[0]?.id || ''
  );
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { lockProvider, lockLocation } = getReschedulePolicy(clinic);

  const currentChunkDates = bookableDates.slice(
    dateChunkIndex * CHUNK_SIZE,
    (dateChunkIndex + 1) * CHUNK_SIZE
  );

  const getDateSlotCount = (dateIso: string) => {
    const activeProvId =
      lockProvider && appointment
        ? appointment.providerId
        : selectedProviderId || 'any';
    const generated = generateAvailableSlots(
      dateIso,
      activeProvId,
      appointments,
      appointment?.id
    );
    return generated.length;
  };

  useEffect(() => {
    if (!appointment) return;
    const targetDate =
      appointment.date >= REFERENCE_TODAY_ISO
        ? appointment.date
        : bookableDates[0] || REFERENCE_TODAY_ISO;
    setSelectedDate(targetDate);
    const dateIdx = bookableDates.indexOf(targetDate);
    if (dateIdx !== -1) {
      setDateChunkIndex(Math.floor(dateIdx / CHUNK_SIZE));
    } else {
      setDateChunkIndex(0);
    }
    setSelectedTime24('');
    setSelectedProviderId(appointment.providerId);
    setSelectedLocationId(
      appointment.locationId === 'loc-telehealth'
        ? clinic.locations[0]?.id || ''
        : appointment.locationId
    );
    setErrorMessage('');
  }, [appointment, clinic.locations]);

  useEffect(() => {
    if (!appointment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appointment, onClose, submitting]);

  useEffect(() => {
    if (!appointment || !selectedDate || !selectedProviderId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setErrorMessage('');

    fetchAvailability({
      date: selectedDate,
      providerId: lockProvider ? appointment.providerId : selectedProviderId,
      excludeAppointmentId: appointment.id,
      clinicSlug: clinic.id,
    })
      .then((res) => {
        if (!cancelled) {
          setSlots(res.slots);
          setSelectedTime24('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSlots([]);
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to load open times.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appointment, selectedDate, selectedProviderId]);

  if (!appointment) return null;

  const morningSlots = slots.filter((s) => s.period === 'morning' && s.available);
  const afternoonSlots = slots.filter((s) => s.period === 'afternoon' && s.available);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime24) {
      setErrorMessage('Please select both a new date and an available time slot.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    const targets = resolveRescheduleTargets(clinic, appointment, {
      providerId: selectedProviderId,
      locationId: selectedLocationId,
    });
    try {
      await onConfirm(appointment.id, {
        date: selectedDate,
        time24: selectedTime24,
        providerId: targets.providerId,
        locationId: targets.locationId,
        visitMode: 'in-person',
      });
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not reschedule appointment. Please try another slot.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <h2
              id="reschedule-dialog-title"
              className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50"
            >
              Reschedule Appointment
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {appointment.appointmentTypeName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reschedule dialog"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-5">
          {/* Current appointment summary */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Current Scheduled Time
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-800 dark:text-slate-200">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Calendar className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                <span>{formatDateLabel(appointment.date)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <Clock className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                <span>{formatTime12h(appointment.time24)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <User className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                <span>{appointment.providerName}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <MapPin className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                <span>{appointment.locationName}</span>
              </span>
            </div>
          </div>

          {/* Specialist & Clinic Location (with clinic policy locks) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                id="reschedule-provider-label"
                onClick={() =>
                  document.getElementById('reschedule-provider')?.focus()
                }
                className="flex items-center justify-between gap-2 text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                <span>Specialist</span>
                {lockProvider ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span>Locked</span>
                  </span>
                ) : null}
              </label>
              <ThemedSelect
                id="reschedule-provider"
                labelId="reschedule-provider-label"
                value={selectedProviderId}
                disabled={lockProvider || submitting}
                onChange={setSelectedProviderId}
                options={providers.map((prov) => ({
                  value: prov.id,
                  label: `${prov.name}, ${prov.credentials}`,
                }))}
                size="sm"
              />
              {lockProvider ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Specialist cannot be changed for this clinic.
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <label
                id="reschedule-location-label"
                onClick={() =>
                  document.getElementById('reschedule-location')?.focus()
                }
                className="flex items-center justify-between gap-2 text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                <span>Clinic Location</span>
                {lockLocation ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span>Locked</span>
                  </span>
                ) : null}
              </label>
              <ThemedSelect
                id="reschedule-location"
                labelId="reschedule-location-label"
                value={selectedLocationId}
                disabled={lockLocation || submitting}
                onChange={setSelectedLocationId}
                options={clinic.locations.map((loc) => ({
                  value: loc.id,
                  label: `${loc.name} — ${loc.address}`,
                }))}
                size="sm"
              />
              {lockLocation ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Location cannot be changed for this clinic.
                </p>
              ) : null}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Select Date (2-Week Schedule)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatDateLabel(selectedDate)}
                </span>
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
                const isSelected = selectedDate === dateIso;
                const count = getDateSlotCount(dateIso);
                const isFullyBooked = count === 0;

                return (
                  <button
                    key={dateIso}
                    type="button"
                    disabled={isFullyBooked}
                    onClick={() => {
                      if (!isFullyBooked) {
                        setSelectedDate(dateIso);
                        setSelectedTime24('');
                      }
                    }}
                    aria-pressed={isSelected}
                    className={`relative flex flex-col items-center justify-center rounded-lg border px-1 py-1 text-center transition-colors min-h-[46px] ${
                      isFullyBooked
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-600'
                        : isSelected
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
                          isSelected
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
          </div>

          {/* Time Slots */}
          <div aria-busy={loadingSlots}>
            <div className="flex items-center justify-between gap-2">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                Select New Time
              </span>
              {loadingSlots ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-300"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Checking open times...</span>
                </span>
              ) : null}
            </div>

            {loadingSlots ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-11 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                No clinic hours on this date. Please choose another day.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                {[
                  { heading: 'Morning', items: morningSlots },
                  { heading: 'Afternoon', items: afternoonSlots },
                ].map((group) =>
                  group.items.length > 0 ? (
                    <div key={group.heading}>
                      <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {group.heading}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {group.items.map((slot) => {
                          const isSelected = selectedTime24 === slot.time24;
                          return (
                            <button
                              key={slot.time24}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => setSelectedTime24(slot.time24)}
                              aria-pressed={isSelected}
                              className={`rounded-lg border px-3 py-2.5 text-sm font-mono tabular-nums font-medium transition-colors min-h-[44px] ${
                                !slot.available
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-600'
                                  : isSelected
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
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 min-h-[44px]"
            >
              Keep Current Time
            </button>
            <button
              type="submit"
              disabled={submitting || loadingSlots || !selectedTime24}
              aria-busy={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 min-h-[44px]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>
                {submitting ? 'Updating Visit...' : 'Confirm Reschedule'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
