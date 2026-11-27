import { Accessibility, Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { ClinicProfile } from '../types/clinic';

interface ClinicInfoViewProps {
  clinic: ClinicProfile;
}

export function ClinicInfoView({ clinic }: ClinicInfoViewProps) {
  return (
    <div className="flex flex-1 flex-col min-w-0 space-y-4">
      {/* Compact Clinic Header */}
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-text dark:text-brand-text-dark">
            {clinic.specialty}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {clinic.name}
          </h1>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
            <Phone className="h-3.5 w-3.5 shrink-0 text-brand-text dark:text-brand-text-dark" aria-hidden="true" />
            <span>{clinic.phone}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0 text-brand-text dark:text-brand-text-dark" aria-hidden="true" />
            <span className="break-all">{clinic.supportEmail}</span>
          </span>
        </div>
      </div>

      {/* Clinic Locations */}
      <section aria-labelledby="clinic-locations-heading" className="min-w-0 space-y-3">
        <h2
          id="clinic-locations-heading"
          className="font-display text-base font-semibold text-slate-900 dark:text-slate-50"
        >
          Clinic Locations &amp; Accessibility
        </h2>

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {clinic.locations.map((loc) => (
            <article
              key={loc.id}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <h3 className="break-words font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                  {loc.name}
                </h3>
                <p className="mt-0.5 flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-text dark:text-brand-text-dark" aria-hidden="true" />
                  <span className="min-w-0 break-words">
                    {loc.address}, {loc.cityStateZip}
                  </span>
                </p>
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <p className="flex items-start gap-1.5">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>{loc.hours}</span>
                </p>
                <p className="flex items-center gap-1.5 font-mono tabular-nums">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>{loc.phone}</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  {loc.parkingNote}
                </p>
              </div>

              <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Accessibility Features</span>
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
                  {loc.accessibilityFeatures.map((feat) => (
                    <li key={feat}>{feat}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Scheduling & Cancellation Policy */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
          Patient Scheduling &amp; Cancellation Policy
        </h2>
        <div className="mt-2 grid gap-4 text-xs leading-relaxed text-slate-600 md:grid-cols-2 dark:text-slate-300">
          <p>
            Patients may book, reschedule, or cancel eligible appointments
            directly through this portal 24 hours a day. Whenever possible,
            please provide at least {clinic.cancellationPolicyHours} hours notice
            before cancelling or moving a visit so another patient can use the
            open time.
          </p>
          <p>
            If you need an interpreter, wheelchair assistance, or sensory-friendly
            check-in accommodations, select them during booking or call our front
            desk at{' '}
            <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
              {clinic.phone}
            </span>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
