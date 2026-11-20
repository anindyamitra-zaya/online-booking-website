import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Loader2,
  MapPin,
  User,
  X,
} from 'lucide-react';
import type { Appointment, ValidationErrors } from '../types/clinic';
import {
  formatDateLabel,
  formatTime12h,
  validateCancellationReason,
} from '../utils/appointments';
import { ThemedSelect } from './ThemedSelect';

interface CancelModalProps {
  appointment: Appointment | null;
  cancellationPolicyHours: number;
  cancellationReasons?: string[];
  onClose: () => void;
  onConfirm: (appointmentId: string, reason: string) => Promise<void>;
}

const DEFAULT_CANCELLATION_REASONS = [
  'Schedule conflict',
  'Symptoms improved / no longer needed',
  'Need a different provider or location',
  'Transportation or travel issue',
  'Other reason',
];

export function CancelModal({
  appointment,
  cancellationPolicyHours,
  cancellationReasons,
  onClose,
  onConfirm,
}: CancelModalProps) {
  const reasonsList =
    cancellationReasons && cancellationReasons.length > 0
      ? cancellationReasons
      : DEFAULT_CANCELLATION_REASONS;
  const [selectedReason, setSelectedReason] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!appointment) return;
    setSelectedReason('');
    setCustomNote('');
    setFieldErrors({});
    setErrorMessage('');
  }, [appointment]);

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

  if (!appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCancellationReason(selectedReason, customNote);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setErrorMessage('');
    const finalReason =
      selectedReason === 'Other reason'
        ? customNote.trim()
        : customNote.trim()
          ? `${selectedReason} — ${customNote.trim()}`
          : selectedReason.trim();

    try {
      await onConfirm(appointment.id, finalReason);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to cancel appointment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isOtherReason = selectedReason === 'Other reason';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="cancel-dialog-title"
                className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
              >
                Cancel Appointment
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                This will release your scheduled visit time back to the clinic.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close cancellation dialog"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5" noValidate>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {appointment.appointmentTypeName}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-700 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                <Calendar className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                <span>{formatDateLabel(appointment.date)}</span>
                <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0 ml-1" aria-hidden="true" />
                <span>{formatTime12h(appointment.time24)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                <span>{appointment.providerName}, {appointment.providerCredentials}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                <span>{appointment.locationName}</span>
              </span>
            </div>
          </div>

          <div>
            <label
              id="cancel-reason-label"
              onClick={() =>
                document.getElementById('cancel-reason-select')?.focus()
              }
              className="block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              Reason for Cancellation
            </label>
            <ThemedSelect
              id="cancel-reason-select"
              labelId="cancel-reason-label"
              value={selectedReason}
              disabled={submitting}
              required
              invalid={Boolean(fieldErrors.reason)}
              describedBy={fieldErrors.reason ? 'cancel-reason-err' : undefined}
              onChange={(val) => {
                setSelectedReason(val);
                setFieldErrors((prev) => ({ ...prev, reason: '' }));
              }}
              options={reasonsList.map((reason) => ({
                value: reason,
                label: reason,
              }))}
              placeholder="Select a reason for cancellation..."
              size="sm"
            />
            {fieldErrors.reason ? (
              <p
                id="cancel-reason-err"
                role="alert"
                className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {fieldErrors.reason}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="cancel-note-input"
              className="block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              {isOtherReason
                ? 'Describe your cancellation reason'
                : 'Additional notes for care team (optional)'}
            </label>
            <textarea
              id="cancel-note-input"
              rows={2}
              value={customNote}
              disabled={submitting}
              aria-required={isOtherReason ? 'true' : undefined}
              aria-invalid={Boolean(fieldErrors.customNote)}
              aria-describedby={
                fieldErrors.customNote ? 'cancel-note-err' : undefined
              }
              onChange={(e) => {
                setCustomNote(e.target.value);
                setFieldErrors((prev) => ({ ...prev, customNote: '' }));
              }}
              placeholder={
                isOtherReason
                  ? 'Please share why you are cancelling this visit...'
                  : 'Share any details or let us know if you need help rebooking...'
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {fieldErrors.customNote ? (
              <p
                id="cancel-note-err"
                role="alert"
                className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {fieldErrors.customNote}
              </p>
            ) : null}
          </div>

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Clinic policy requests at least {cancellationPolicyHours} hours notice
            for cancellations when possible. Need a different day instead? You can
            close this dialog and choose Reschedule.
          </p>

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
              Keep Appointment
            </button>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-500 min-h-[44px]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>
                {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
