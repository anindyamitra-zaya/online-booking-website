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
  formatDateLabel,
  formatTime12h,
  generateIcsContent,
} from '../utils/appointments';
import { REFERENCE_TODAY_ISO } from '../data/seedClinicData';
import { StatusLabel } from './StatusLabel';

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
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h1
            id="appointments-directory-heading"
            className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-slate-50"
          >
            <span>Upcoming Appointments</span>
            <span
              data-testid="appointments-heading-count"
              className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-teal-800 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-200"
            >
              {allUpcoming.length}
            </span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            View, reschedule, or cancel your upcoming visits at{' '}
            {clinic.shortName}.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {allUpcoming.length > 0 ? (
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
          ) : null}

          <button
            type="button"
            onClick={() => onStartBooking()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
          >
            <CalendarPlus
              className="h-4 w-4 text-teal-700 dark:text-teal-400"
              aria-hidden="true"
            />
            <span>Book New Visit</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error ? (
        <div role="alert" className="px-6 py-8 text-center">
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
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-2 w-full max-w-md">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-5 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-52 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedAppointments.length === 0 ? (
        <div className="px-6 py-10 text-center">
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
                onClick={() => onStartBooking()}
                className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 min-h-[40px]"
              >
                Book Appointment
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
                className="px-5 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusLabel status={appt.status} />
                      <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                        {appt.appointmentTypeName}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        <Calendar className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                        <span>{formatDateLabel(appt.date)}</span>
                        <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0 ml-0.5" aria-hidden="true" />
                        <span>{formatTime12h(appt.time24)}</span>
                        <span className="font-sans font-normal text-slate-500 dark:text-slate-400">
                          ({appt.durationMinutes} min)
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                        <User className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                        <span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {appt.providerName}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            , {appt.providerCredentials}
                          </span>
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <MapPin className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
                        <span>{appt.locationName}</span>
                      </span>
                    </div>

                    {appt.status === 'rescheduled' && appt.previousDate ? (
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Moved from {formatDateLabel(appt.previousDate)} at{' '}
                        <span className="font-mono tabular-nums">
                          {formatTime12h(appt.previousTime24 || '')}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`details-${appt.id}`}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : appt.id)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap min-h-[36px]"
                    >
                      <span>Details &amp; Prep</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadIcs(appt)}
                      aria-label={`Download calendar file for ${appt.appointmentTypeName} on ${formatDateLabel(appt.date)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap min-h-[36px]"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Calendar</span>
                    </button>

                    {modifiable ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenReschedule(appt)}
                          aria-label={`Reschedule ${appt.appointmentTypeName} on ${formatDateLabel(appt.date)}`}
                          className="inline-flex items-center justify-center rounded-lg border border-teal-700 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-500 dark:bg-slate-950 dark:text-teal-300 dark:hover:bg-teal-950/60 whitespace-nowrap min-h-[36px]"
                        >
                          Reschedule
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenCancel(appt)}
                          aria-label={`Cancel ${appt.appointmentTypeName} on ${formatDateLabel(appt.date)}`}
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
                    className="mt-3 grid gap-4 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2 dark:border-slate-800/80"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Location &amp; Notes
                      </p>
                      <p className="text-slate-700 dark:text-slate-200">
                        {appt.locationAddress}
                      </p>
                      {appt.reasonForVisit ? (
                        <p className="text-slate-600 dark:text-slate-300">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            Visit note:{' '}
                          </span>
                          {appt.reasonForVisit}
                        </p>
                      ) : null}
                      {appt.accommodations.length > 0 ? (
                        <p className="text-slate-600 dark:text-slate-300">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            Accommodations:{' '}
                          </span>
                          {appt.accommodations.join(', ')}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Preparation Checklist
                      </p>
                      {appt.preparationInstructions.length > 0 ? (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600 dark:text-slate-300">
                          {appt.preparationInstructions.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          No special preparation required for this visit.
                        </p>
                      )}
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
