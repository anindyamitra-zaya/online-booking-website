import { useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  MapPin,
  Search,
  User,
  X,
} from 'lucide-react';
import type { Appointment, ClinicProfile } from '../types/clinic';
import {
  canModifyAppointment,
  filterUpcomingAppointments,
  formatDateWithWeekday,
  formatTime12h,
  generateIcsContent,
} from '../utils/appointments';
import { REFERENCE_TODAY_ISO } from '../data/seedClinicData';
import { StatusLabel } from './StatusLabel';
import { AppointmentsRowsSkeleton } from './PortalSkeletons';

interface AppointmentsViewProps {
  clinic: ClinicProfile;
  patientId: string;
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  onStartBooking: (preselect?: {
    appointmentTypeId?: string;
    providerId?: string;
  }) => void;
  onOpenReschedule: (appointment: Appointment) => void;
  onOpenCancel: (appointment: Appointment) => void;
  onRetryLoad: () => void;
}

export function AppointmentsView({
  clinic,
  appointments,
  loading,
  error,
  onStartBooking,
  onOpenReschedule,
  onOpenCancel,
  onRetryLoad,
}: AppointmentsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allUpcoming = filterUpcomingAppointments(
    appointments,
    '',
    REFERENCE_TODAY_ISO
  );

  const displayedAppointments = filterUpcomingAppointments(
    appointments,
    searchQuery,
    REFERENCE_TODAY_ISO
  );

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

  return (
    <section
      aria-labelledby="appointments-directory-heading"
      className="flex flex-1 flex-col w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5 dark:border-slate-800">
        <div>
          <h1
            id="appointments-directory-heading"
            className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-slate-50"
          >
            <span>Upcoming Appointments</span>
            {loading ? (
              <span
                aria-hidden="true"
                data-testid="appointments-heading-count-skeleton"
                className="inline-block h-5 w-7 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800"
              />
            ) : (
              <span
                data-testid="appointments-heading-count"
                className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-brand-soft-border bg-brand-soft-bg px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-brand-text dark:border-brand-soft-border-dark dark:bg-brand-soft-bg-dark dark:text-brand-text-dark"
              >
                {allUpcoming.length}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            View, reschedule, or cancel your upcoming visits at{' '}
            {clinic.shortName}.
          </p>
        </div>

        {loading ? (
          <div
            aria-hidden="true"
            className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
          >
            <div className="h-[38px] w-full sm:w-56 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-[38px] w-full sm:w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : allUpcoming.length > 0 ? (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-56">
              <label htmlFor="appointment-search" className="sr-only">
                Search upcoming appointments
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="appointment-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search appointments..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 min-h-[38px]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              data-testid="appointments-header-book-btn"
              onClick={() => onStartBooking()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Book Appointment</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Error State */}
      {error ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetryLoad}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 min-h-[40px]"
          >
            Try Again
          </button>
        </div>
      ) : loading ? (
        <AppointmentsRowsSkeleton count={3} />
      ) : displayedAppointments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {searchQuery
              ? 'No upcoming appointments match your search'
              : 'You have no upcoming appointments scheduled'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">
            {searchQuery
              ? 'Try clearing your search term to view all upcoming appointments.'
              : `Schedule an in-person clinic visit at ${clinic.shortName}.`}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 min-h-[40px]"
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                data-testid="appointments-empty-book-btn"
                onClick={() => onStartBooking()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors min-h-[40px]"
              >
                <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Book Appointment</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul
          data-testid="appointments-list"
          className="divide-y divide-slate-200 dark:divide-slate-800"
        >
          {displayedAppointments.map((appt) => {
            const modifiable = canModifyAppointment(appt, REFERENCE_TODAY_ISO);
            const isExpanded = expandedId === appt.id;

            return (
              <li
                key={appt.id}
                data-appointment-id={appt.id}
                className="min-w-0 px-3.5 py-3 sm:px-5 sm:py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
              >
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusLabel status={appt.status} />
                      <h2 className="min-w-0 break-words font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                        {appt.appointmentTypeName}
                      </h2>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Calendar
                            className="h-3.5 w-3.5 text-brand-text dark:text-brand-text-dark shrink-0"
                            aria-hidden="true"
                          />
                          <span className="break-words">{formatDateWithWeekday(appt.date)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <Clock
                            className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{formatTime12h(appt.time24)}</span>
                          <span className="font-sans font-normal text-slate-500 dark:text-slate-400">
                            ({appt.durationMinutes} min)
                          </span>
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center shrink-0">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`details-${appt.id}`}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : appt.id)
                      }
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap min-h-[36px]"
                    >
                      <span>Details</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadIcs(appt)}
                      aria-label={`Download calendar file for ${appt.appointmentTypeName} on ${formatDateWithWeekday(appt.date)}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap min-h-[36px]"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Calendar</span>
                    </button>

                    {modifiable ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenReschedule(appt)}
                          aria-label={`Reschedule ${appt.appointmentTypeName} on ${formatDateWithWeekday(appt.date)}`}
                          className="inline-flex items-center justify-center rounded-lg border border-brand-soft-border bg-white px-3 py-1.5 text-xs font-semibold text-brand-text hover:bg-brand-soft-bg dark:border-brand-soft-border-dark dark:bg-slate-950 dark:text-brand-text-dark dark:hover:bg-brand-soft-bg-dark whitespace-nowrap min-h-[36px]"
                        >
                          Reschedule
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenCancel(appt)}
                          aria-label={`Cancel ${appt.appointmentTypeName} on ${formatDateWithWeekday(appt.date)}`}
                          className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/60 whitespace-nowrap min-h-[36px]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div
                    id={`details-${appt.id}`}
                    className="mt-3 grid min-w-0 gap-4 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2 dark:border-slate-800/80"
                  >
                    <dl className="min-w-0 space-y-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <User
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-text dark:text-brand-text-dark"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <dt className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Specialist
                          </dt>
                          <dd className="mt-0.5 break-words font-medium text-slate-900 dark:text-slate-100">
                            {appt.providerName}, {appt.providerCredentials}
                          </dd>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-start gap-2">
                        <MapPin
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-text dark:text-brand-text-dark"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <dt className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Location
                          </dt>
                          <dd className="mt-0.5 break-words font-medium text-slate-900 dark:text-slate-100">
                            {appt.locationName}
                          </dd>
                          <dd className="break-words text-slate-600 dark:text-slate-300">
                            {appt.locationAddress}
                          </dd>
                        </div>
                      </div>
                    </dl>

                    <div className="min-w-0">
                      <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Visit Reason
                      </p>
                      <p className="mt-1 break-words text-slate-700 dark:text-slate-200">
                        {appt.reasonForVisit || 'Not specified'}
                      </p>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
