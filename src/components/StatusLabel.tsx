import { CalendarClock, CheckCircle2, History, XCircle } from 'lucide-react';
import type { AppointmentStatus } from '../types/clinic';

interface StatusLabelProps {
  status: AppointmentStatus;
}

const STATUS_CONFIG: Record<
  AppointmentStatus,
  {
    label: string;
    classes: string;
    Icon: typeof CheckCircle2;
  }
> = {
  confirmed: {
    label: 'Confirmed',
    classes:
      'text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800/80',
    Icon: CheckCircle2,
  },
  rescheduled: {
    label: 'Rescheduled',
    classes:
      'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-800/80',
    Icon: CalendarClock,
  },
  cancelled: {
    label: 'Cancelled',
    classes:
      'text-rose-800 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/60 dark:border-rose-800/80',
    Icon: XCircle,
  },
  completed: {
    label: 'Completed',
    classes:
      'text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800/80 dark:border-slate-700',
    Icon: History,
  },
};

export function StatusLabel({ status }: StatusLabelProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${config.classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
