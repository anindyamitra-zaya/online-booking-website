import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Calendar,
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
  formatDateWithWeekday,
  formatLocationFullAddress,
  formatTime12h,
  generateAvailableSlots,
  getAvailableMonths,
  getBookableDates,
  getCalendarMonthGrid,
  getCommonVisitReasons,
  getReschedulePolicy,
  isReasonSelected,
  resolveRescheduleTargets,
  toggleVisitReason,
} from '../utils/appointments';
import { REFERENCE_TODAY_ISO } from '../data/seedClinicData';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { CalendarSlotPicker } from './CalendarSlotPicker';
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
      reasonForVisit?: string;
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
  const minBookableIso = bookableDates[0] || REFERENCE_TODAY_ISO;
  const maxBookableIso =
    bookableDates[bookableDates.length - 1] || REFERENCE_TODAY_ISO;
  const availableMonths = getAvailableMonths(REFERENCE_TODAY_ISO, 90);

  const [monthIndex, setMonthIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(minBookableIso);
  const [selectedTime24, setSelectedTime24] = useState<string>('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    clinic.locations[0]?.id || ''
  );
  const [reasonForVisit, setReasonForVisit] = useState<string>(
    appointment?.reasonForVisit || ''
  );
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useDialogAccessibility(Boolean(appointment), dialogRef, onClose, submitting);

  const { lockProvider, lockLocation } = getReschedulePolicy(clinic);

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

  const getDateSlotCount = (dateIso: string) => {
    const activeProvId =
      lockProvider && appointment
        ? appointment.providerId
        : selectedProviderId || appointment?.providerId || '';
    const generated = generateAvailableSlots(
      dateIso,
      activeProvId,
      appointments,
      appointment?.id
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
      setSelectedDate(targetDateIso);
      setSelectedTime24('');
    }
  };

  useEffect(() => {
    if (!appointment) return;
    const targetDate =
      appointment.date >= REFERENCE_TODAY_ISO
        ? appointment.date
        : minBookableIso;
    setSelectedDate(targetDate);
    const targetMonthKey = targetDate.slice(0, 7);
    const foundMonthIdx = availableMonths.findIndex(
      (m) => m.key === targetMonthKey
    );
    setMonthIndex(foundMonthIdx >= 0 ? foundMonthIdx : 0);
    setSelectedTime24('');
    setSelectedProviderId(appointment.providerId);
    setSelectedLocationId(
      appointment.locationId === 'loc-telehealth'
        ? clinic.locations[0]?.id || ''
        : appointment.locationId
    );
    setReasonForVisit(appointment.reasonForVisit || '');
    setErrorMessage('');
  }, [appointment, clinic.locations]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime24) {
      setErrorMessage('Please select a new date and time slot.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const targets = resolveRescheduleTargets(clinic, appointment, {
        providerId: selectedProviderId,
        locationId: selectedLocationId,
      });
      await onConfirm(appointment.id, {
        date: selectedDate,
        time24: selectedTime24,
        providerId: targets.providerId,
        locationId: targets.locationId,
        visitMode: 'in-person',
        reasonForVisit: reasonForVisit.trim() || appointment.reasonForVisit,
      });
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to reschedule appointment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const matchedLocation = clinic.locations.find(
    (l) => l.id === appointment.locationId
  );
  const currentFullAddress =
    appointment.locationAddress || formatLocationFullAddress(matchedLocation);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-dialog-title"
        className="w-full max-w-5xl min-w-0 max-h-[90dvh] flex flex-col justify-between overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5 sm:px-6 sm:py-4 dark:border-slate-800">
          <div>
            <h2
              id="reschedule-dialog-title"
              className="font-display text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50"
            >
              Reschedule Appointment
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
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

        <form onSubmit={handleSubmit} className="min-w-0 space-y-4 px-4 py-3.5 sm:px-6 sm:py-4">
          {/* Current appointment summary */}
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Current Scheduled Time
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-800 dark:text-slate-200">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Calendar
                  className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                  aria-hidden="true"
                />
                <span>{formatDateWithWeekday(appointment.date)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <Clock
                  className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                  aria-hidden="true"
                />
                <span>{formatTime12h(appointment.time24)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <User
                  className="h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                  aria-hidden="true"
                />
                <span>{appointment.providerName}</span>
              </span>
              <span className="inline-flex min-w-0 items-start gap-1.5 text-slate-600 dark:text-slate-400">
                <MapPin
                  className="mt-0.5 h-4 w-4 text-brand-text dark:text-brand-text-dark shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0 break-words">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {appointment.locationName}
                  </span>
                  {currentFullAddress ? ` — ${currentFullAddress}` : ''}
                </span>
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

          {/* 1-Month Calendar (Left) + Time Slots (Right) */}
          <CalendarSlotPicker
            activeMonth={activeMonth}
            monthIndex={monthIndex}
            totalMonths={availableMonths.length}
            monthCells={monthCells}
            selectedDate={selectedDate}
            selectedTime24={selectedTime24}
            slots={slots}
            loadingSlots={loadingSlots}
            getDateSlotCount={getDateSlotCount}
            onMonthNavigate={handleMonthNavigate}
            onSelectDate={(dateIso) => {
              setSelectedDate(dateIso);
              setSelectedTime24('');
            }}
            onSelectTime={(time24) => {
              setSelectedTime24(time24);
              if (errorMessage) setErrorMessage('');
            }}
            slotsHeading="Select New Time"
            variant="modal"
          />

          {/* Reason for Visit */}
          <div className="min-w-0 space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
              <label
                htmlFor="reschedule-reason"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Reason for Visit
              </label>
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Tap common reasons below or edit text
              </span>
            </div>
            <textarea
              id="reschedule-reason"
              rows={2}
              value={reasonForVisit}
              onChange={(e) => {
                setReasonForVisit(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="Describe your symptoms or reason for visit..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
            {appointment.appointmentTypeId ? (
              <div className="mt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Common reasons (tap to add or remove)
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {getCommonVisitReasons(clinic, appointment.appointmentTypeId).map((r) => {
                    const selected = isReasonSelected(reasonForVisit, r);
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setReasonForVisit((prev) => toggleVisitReason(prev, r));
                          if (errorMessage) setErrorMessage('');
                        }}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-brand-primary bg-brand-primary text-brand-fg'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 sm:gap-3 dark:border-slate-800">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <span className="sm:hidden">Keep Time</span>
              <span className="hidden sm:inline">Keep Current Time</span>
            </button>
            <button
              type="submit"
              disabled={submitting || loadingSlots || !selectedTime24}
              aria-busy={submitting}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-xs sm:px-5 sm:text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 min-h-[40px]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
              <span>
                {submitting ? (
                  'Updating...'
                ) : (
                  <>
                    <span className="sm:hidden">Reschedule</span>
                    <span className="hidden sm:inline">Confirm Reschedule</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
