import { BadgeCheck, Calendar, LogOut, MapPin, Phone } from 'lucide-react';
import type { ClinicProfile, PatientProfile } from '../types/clinic';
import { formatDateLabel, getProviderInitials } from '../utils/appointments';

interface PatientBlockProps {
  clinic: ClinicProfile;
  patient: PatientProfile;
  patientKind?: 'established' | 'new' | null;
  onLogoutPatient: () => void;
}

export function PatientBlock({
  clinic: _clinic,
  patient,
  patientKind,
  onLogoutPatient,
}: PatientBlockProps) {
  const cityStatePin = [patient.city, patient.state, patient.pin]
    .filter(Boolean)
    .join(', ');
  const addressStr = [patient.street, cityStatePin].filter(Boolean).join(', ');

  return (
    <section
      aria-label="Verified patient details"
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 font-display text-sm font-bold text-teal-800 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-200"
          >
            {getProviderInitials(patient.fullName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
                {patient.fullName}
              </h2>
              <span
                title={
                  patientKind === 'new'
                    ? 'Registered Patient'
                    : 'Verified Patient'
                }
                aria-label={
                  patientKind === 'new'
                    ? 'Registered Patient'
                    : 'Verified Patient'
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {patientKind === 'new' ? 'Registered' : 'Verified'}
                </span>
              </span>
              {patient.sex ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  · {patient.sex}
                </span>
              ) : null}
            </div>

            <dl className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <Calendar
                  className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                  aria-hidden="true"
                />
                <dt className="sr-only">Date of Birth</dt>
                <dd className="font-mono font-medium tabular-nums text-slate-800 dark:text-slate-200">
                  {formatDateLabel(patient.dateOfBirth)}
                </dd>
              </div>

              {patient.phone ? (
                <div className="flex items-center gap-1.5">
                  <Phone
                    className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                    aria-hidden="true"
                  />
                  <dt className="sr-only">Phone</dt>
                  <dd className="font-mono font-medium tabular-nums text-slate-800 dark:text-slate-200">
                    {patient.phone}
                  </dd>
                </div>
              ) : null}

              {addressStr ? (
                <div className="flex items-center gap-1.5">
                  <MapPin
                    className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                    aria-hidden="true"
                  />
                  <dt className="sr-only">Address</dt>
                  <dd className="text-slate-700 dark:text-slate-300">
                    {addressStr}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogoutPatient}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 sm:self-center min-h-[36px]"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Logout Patient</span>
        </button>
      </div>
    </section>
  );
}
