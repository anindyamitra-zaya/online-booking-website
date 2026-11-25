import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import type { ClinicProfile, PatientProfile } from '../types/clinic';
import {
  NewPatientRegistrationPage,
  type VerifiedRegistrationSeed,
} from './NewPatientRegistrationPage';
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
  const [registrationSeed, setRegistrationSeed] =
    useState<VerifiedRegistrationSeed | null>(null);

  if (registrationSeed) {
    return (
      <NewPatientRegistrationPage
        clinic={clinic}
        seed={registrationSeed}
        onRegistered={async (created) => {
          setRegistrationSeed(null);
          await onPatientVerified(created, 'new');
        }}
        onBack={() => setRegistrationSeed(null)}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
      {/* Left Column: Full-Height Clinic Cover Banner with Contact Overlaid */}
      <section
        aria-label="Clinic overview and contact"
        data-testid="landing-clinic-banner"
        className="relative flex min-h-[220px] sm:min-h-[260px] flex-col justify-end overflow-hidden rounded-xl border border-slate-200 lg:col-span-5 lg:min-h-[380px] lg:h-full dark:border-slate-800"
      >
        <SafeImage
          src={clinic.bannerImage}
          alt={`${clinic.name} clinic reception`}
          fallbackType="clinic"
          fallbackLabel={clinic.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent"
        />

        <div className="relative z-10 p-4 sm:p-7 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
            {clinic.specialty}
          </p>
          <h2 className="mt-1 font-display text-xl sm:text-2xl font-bold leading-snug text-balance">
            {clinic.name}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-100">
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <Phone
                className="h-3.5 w-3.5 shrink-0 text-teal-300"
                aria-hidden="true"
              />
              <span>{clinic.phone}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail
                className="h-3.5 w-3.5 shrink-0 text-teal-300"
                aria-hidden="true"
              />
              <span>{clinic.supportEmail}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Right Column: Matching-Height Patient Verification Card */}
      <section
        aria-labelledby="patient-verify-heading"
        data-testid="landing-patient-card"
        className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-7 lg:col-span-7 lg:h-full dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
              Patient Portal
            </p>
            <h1
              id="patient-verify-heading"
              className="mt-0.5 font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50"
            >
              Enter Patient Details
            </h1>
          </div>

          <div className="mt-5">
            <PatientEntryForm
              idPrefix="gate"
              submitLabel="Continue"
              samplePatients={clinic.samplePatients}
              onPatientReady={onPatientVerified}
              onPhoneVerifiedForRegistration={(seed) =>
                setRegistrationSeed(seed)
              }
            />
          </div>
        </div>

        <p className="mt-6 border-t border-slate-100 pt-3.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Need help? Call {clinic.shortName} at{' '}
          <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-200">
            {clinic.phone}
          </span>
          .
        </p>
      </section>
    </div>
  );
}
