import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { ClinicProfile, PatientProfile } from '../types/clinic';
import { PatientEntryForm } from './PatientEntryForm';
import { SafeImage } from './SafeImage';

interface PatientVerificationGateProps {
  clinic: ClinicProfile;
  onPatientVerified: (
    patient: PatientProfile,
    kind: 'established' | 'new'
  ) => Promise<void> | void;
}

export function PatientVerificationGate({
  clinic,
  onPatientVerified,
}: PatientVerificationGateProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
      {/* Left Column: Clinic Cover Image fills vertical slack so locations stay snug */}
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        <section className="relative flex-1 min-h-[210px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <SafeImage
            src={clinic.bannerImage}
            alt={`${clinic.name} clinic reception`}
            fallbackType="clinic"
            fallbackLabel={clinic.name}
            className="h-48 w-full object-cover lg:absolute lg:inset-0 lg:h-full"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
              {clinic.specialty}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-bold sm:text-2xl text-balance">
              {clinic.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-200">
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <Phone className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />
                {clinic.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />
                {clinic.supportEmail}
              </span>
            </div>
          </div>
        </section>

        <section
          aria-label="Clinic locations overview"
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div
            className={`grid gap-3 ${
              clinic.locations.length > 1 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
            }`}
          >
            {clinic.locations.map((loc) => (
              <div
                key={loc.id}
                className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {loc.name}
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <MapPin
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-400"
                    aria-hidden="true"
                  />
                  <span>
                    {loc.address}, {loc.cityStateZip}
                  </span>
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{loc.hours}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Online patient scheduling 24/7 · At least{' '}
            {clinic.cancellationPolicyHours} hours notice requested for
            cancellations or rescheduling.
          </p>
        </section>
      </div>

      {/* Right Column: Single Book & Manage Appointments Verification Entry */}
      <section
        aria-labelledby="patient-verify-heading"
        className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <div className="border-b border-slate-200 pb-3.5 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
              Book &amp; Manage Appointments
            </p>
            <h1
              id="patient-verify-heading"
              className="mt-0.5 font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50"
            >
              Enter Patient Details
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Verify your name and date of birth to book a new visit or manage
              upcoming appointments. New patients will be guided through quick
              registration.
            </p>
          </div>

          <div className="mt-4">
            <PatientEntryForm
              idPrefix="gate"
              submitLabel="Continue"
              samplePatients={clinic.samplePatients}
              onPatientReady={onPatientVerified}
            />
          </div>
        </div>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Need help? Call {clinic.shortName} scheduling at{' '}
          <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-200">
            {clinic.phone}
          </span>
          .
        </p>
      </section>
    </div>
  );
}
