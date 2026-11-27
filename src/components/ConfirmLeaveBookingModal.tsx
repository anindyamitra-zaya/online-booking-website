import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface ConfirmLeaveBookingModalProps {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
}

export function ConfirmLeaveBookingModal({
  open,
  onStay,
  onDiscard,
}: ConfirmLeaveBookingModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogAccessibility(open, dialogRef, onStay);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onStay();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-booking-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="leave-booking-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              Discard booking in progress?
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              You have unsaved appointment details. Leaving this step will clear your selected time and visit details.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onStay}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Continue Booking
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
          >
            Discard &amp; Leave
          </button>
        </div>
      </div>
    </div>
  );
}
