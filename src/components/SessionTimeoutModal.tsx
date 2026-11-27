import { useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

interface SessionTimeoutModalProps {
  open: boolean;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

export function SessionTimeoutModal({
  open,
  onStaySignedIn,
  onSignOut,
}: SessionTimeoutModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogAccessibility(open, dialogRef, onStaySignedIn);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="session-timeout-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              Your session will end soon
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Due to inactivity, your secure session will expire shortly to protect your health information.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sign Out Now
          </button>
          <button
            type="button"
            onClick={onStaySignedIn}
            className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}
