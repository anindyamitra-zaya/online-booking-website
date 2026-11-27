import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { ClinicSamplePatient, PatientProfile } from '../types/clinic';
import {
  lookupPatient,
  sendPhoneVerificationCode,
  verifyPhoneVerificationCode,
} from '../services/clinicApi';
import {
  combineFullName,
  formatDateLabel,
  formatResendLabel,
  parseMmDdYyyyToIso,
  splitFullName,
  validatePatientLookup,
  validatePhoneNumber,
  validateVerificationCode,
} from '../utils/appointments';
import type { VerifiedRegistrationSeed } from './NewPatientRegistrationPage';
import { SegmentedDateInput } from './SegmentedDateInput';
import { GoogleRecaptchaWidget } from './GoogleRecaptchaWidget';

interface PatientEntryFormProps {
  idPrefix?: string;
  submitLabel?: string;
  samplePatients?: ClinicSamplePatient[];
  onPatientReady: (
    patient: PatientProfile,
    kind: 'established' | 'new'
  ) => Promise<void> | void;
  onPhoneVerifiedForRegistration: (seed: VerifiedRegistrationSeed) => void;
  onCancel?: () => void;
}

const RESEND_COOLDOWN_SECONDS = 60;

export function PatientEntryForm({
  idPrefix = 'patient',
  submitLabel = 'Continue',
  samplePatients,
  onPatientReady,
  onPhoneVerifiedForRegistration,
  onCancel,
}: PatientEntryFormProps) {
  const quickSamples = samplePatients ?? [];
  const [stage, setStage] = useState<'lookup' | 'verify-phone'>('lookup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Phone verification state
  const [phone, setPhone] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [previewCode, setPreviewCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // 60s countdown timer for Resend Code button
  useEffect(() => {
    if (stage !== 'verify-phone' || !codeSent || resendCountdown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setResendCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [stage, codeSent, resendCountdown]);

  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaResetSignal, setRecaptchaResetSignal] = useState(0);

  const fullName = combineFullName(firstName, lastName);

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePatientLookup(firstName, lastName, dateOfBirth);
    if (!recaptchaToken) {
      validation.recaptcha = 'Please complete the reCAPTCHA verification.';
    }
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      const firstErrorTarget = validation.firstName
        ? document.getElementById(`${idPrefix}-first-name`)
        : validation.lastName
          ? document.getElementById(`${idPrefix}-last-name`)
          : validation.dateOfBirth
            ? document.getElementById(`${idPrefix}-dob`)
            : validation.recaptcha
              ? (document.querySelector('[data-testid="recaptcha-checkbox-button"]') as HTMLElement | null)
              : null;
      if (firstErrorTarget) {
        window.requestAnimationFrame(() => firstErrorTarget.focus());
      }
      return;
    }

    setErrors({});
    setServerError('');
    setSubmitting(true);
    try {
      const normalizedDob =
        parseMmDdYyyyToIso(dateOfBirth.trim()) || dateOfBirth.trim();
      const result = await lookupPatient({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName,
        dateOfBirth: normalizedDob,
        recaptchaToken,
      });

      if (result.found && result.patient) {
        await onPatientReady(result.patient, 'established');
      } else {
        setCodeSent(false);
        setVerificationCode('');
        setPreviewCode('');
        setResendCountdown(0);
        setStage('verify-phone');
      }
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Unable to check patient record. Please try again.'
      );
      setRecaptchaResetSignal((prev) => prev + 1);
      setRecaptchaToken('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const phoneErr = validatePhoneNumber(phone);
    if (phoneErr) {
      setErrors({ phone: phoneErr });
      return;
    }

    setErrors({});
    setServerError('');
    setSendingCode(true);
    try {
      const res = await sendPhoneVerificationCode({ phone: phone.trim() });
      setCodeSent(true);
      setPreviewCode(res.previewCode);
      setVerificationCode('');
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Unable to send verification code. Please try again.'
      );
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSent) {
      await handleSendCode();
      return;
    }

    const phoneErr = validatePhoneNumber(phone);
    const codeErr = validateVerificationCode(verificationCode);
    if (phoneErr || codeErr) {
      setErrors({
        ...(phoneErr ? { phone: phoneErr } : {}),
        ...(codeErr ? { verificationCode: codeErr } : {}),
      });
      const focusId = phoneErr
        ? `${idPrefix}-verify-phone`
        : `${idPrefix}-verify-code`;
      window.requestAnimationFrame(() =>
        document.getElementById(focusId)?.focus()
      );
      return;
    }

    setErrors({});
    setServerError('');
    setSubmitting(true);
    try {
      const res = await verifyPhoneVerificationCode({
        phone: phone.trim(),
        code: verificationCode.trim(),
      });
      onPhoneVerifiedForRegistration({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName,
        dateOfBirth: dateOfBirth.trim(),
        phone: phone.trim(),
        phoneVerificationToken: res.verificationToken,
      });
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Invalid verification code. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillSample = (sample: ClinicSamplePatient) => {
    const split = splitFullName(sample.fullName);
    setStage('lookup');
    setFirstName(sample.firstName || split.firstName);
    setLastName(sample.lastName || split.lastName);
    setDateOfBirth(sample.dateOfBirth);
    setPhone('');
    setCodeSent(false);
    setVerificationCode('');
    setPreviewCode('');
    setResendCountdown(0);
    setErrors({});
    setServerError('');
  };

  if (stage === 'verify-phone') {
    const resendDisabled = sendingCode || submitting || resendCountdown > 0;
    return (
      <form
        onSubmit={handleVerifyCodeSubmit}
        className="min-w-0 space-y-4"
        noValidate
      >
        <div
          role="status"
          className="flex min-w-0 items-start gap-3 rounded-lg border border-brand-soft-border bg-brand-soft-bg px-4 py-3 text-sm text-slate-900 dark:border-brand-soft-border-dark dark:bg-brand-soft-bg-dark dark:text-slate-100"
        >
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-text dark:text-brand-text-dark"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-semibold text-xs">Verify Phone Number</p>
            <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-200">
              No existing record found for{' '}
              <span className="font-semibold">{fullName}</span> (
              <span className="font-mono tabular-nums">
                {formatDateLabel(dateOfBirth.trim())}
              </span>
              ). Please verify your mobile phone number to continue to
              registration.
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${idPrefix}-verify-phone`}
              className="block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              Mobile Phone Number
            </label>
            {codeSent ? (
              <button
                type="button"
                disabled={submitting || sendingCode}
                onClick={() => {
                  setCodeSent(false);
                  setVerificationCode('');
                  setPreviewCode('');
                  setResendCountdown(0);
                  setErrors({});
                  setServerError('');
                }}
                className="text-xs font-semibold text-brand-text hover:underline dark:text-brand-text-dark"
              >
                Change number
              </button>
            ) : null}
          </div>

          <div className="relative mt-1.5">
            <Phone
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id={`${idPrefix}-verify-phone`}
              type="tel"
              autoComplete="tel"
              value={phone}
              disabled={codeSent || sendingCode || submitting}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) {
                  setErrors((prev) => ({ ...prev, phone: '' }));
                }
              }}
              aria-required="true"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={
                errors.phone ? `${idPrefix}-verify-phone-err` : undefined
              }
              placeholder="(512) 555-0199"
              className={`w-full rounded-lg border pl-9 pr-3.5 py-2.5 text-sm font-mono min-h-[42px] ${
                codeSent
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
              }`}
            />
          </div>
          {errors.phone ? (
            <p
              id={`${idPrefix}-verify-phone-err`}
              role="alert"
              className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
            >
              {errors.phone}
            </p>
          ) : null}
        </div>

        {codeSent ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${idPrefix}-verify-code`}
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                6-Digit Verification Code
              </label>
              <button
                type="button"
                data-testid="resend-code-button"
                disabled={resendDisabled}
                onClick={() => handleSendCode()}
                className={`font-mono text-xs font-semibold tabular-nums transition-colors ${
                  resendDisabled
                    ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                    : 'text-brand-text hover:underline dark:text-brand-text-dark'
                }`}
              >
                {formatResendLabel(resendCountdown, sendingCode)}
              </button>
            </div>
            <input
              id={`${idPrefix}-verify-code`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerificationCode(digits);
                if (errors.verificationCode) {
                  setErrors((prev) => ({ ...prev, verificationCode: '' }));
                }
                if (serverError) setServerError('');
              }}
              disabled={submitting}
              aria-required="true"
              aria-invalid={Boolean(errors.verificationCode)}
              aria-describedby={
                errors.verificationCode
                  ? `${idPrefix}-verify-code-err`
                  : `${idPrefix}-verify-code-hint`
              }
              placeholder="Enter 6-digit code"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono tracking-widest text-slate-900 placeholder:tracking-normal placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[42px]"
            />
            {previewCode ? (
              <p
                id={`${idPrefix}-verify-code-hint`}
                className="text-xs text-slate-600 dark:text-slate-300"
              >
                Code sent to <span className="font-mono">{phone}</span> ·
                Verification code:{' '}
                <span
                  data-testid="phone-preview-code"
                  className="font-mono font-semibold text-slate-900 dark:text-slate-100"
                >
                  {previewCode}
                </span>
              </p>
            ) : null}
            {errors.verificationCode ? (
              <p
                id={`${idPrefix}-verify-code-err`}
                role="alert"
                className="text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.verificationCode}
              </p>
            ) : null}
          </div>
        ) : null}

        {serverError ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
          >
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pt-1">
          <button
            type="button"
            disabled={submitting || sendingCode}
            onClick={() => {
              setStage('lookup');
              setResendCountdown(0);
              setErrors({});
              setServerError('');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Back</span>
          </button>

          {!codeSent ? (
            <button
              type="submit"
              disabled={sendingCode}
              aria-busy={sendingCode}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-xs sm:px-5 sm:text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60 whitespace-nowrap shrink-0 min-h-[40px]"
            >
              {sendingCode ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
              <span>
                {sendingCode ? (
                  'Sending...'
                ) : (
                  <>
                    <span className="sm:hidden">Send Code</span>
                    <span className="hidden sm:inline">
                      Send Verification Code
                    </span>
                  </>
                )}
              </span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-xs sm:px-5 sm:text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60 whitespace-nowrap shrink-0 min-h-[40px]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
              <span>
                {submitting ? (
                  'Verifying...'
                ) : (
                  <>
                    <span className="sm:hidden">Verify Phone</span>
                    <span className="hidden sm:inline">
                      Verify Phone Number
                    </span>
                  </>
                )}
              </span>
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleLookupSubmit} className="min-w-0 space-y-4" noValidate>
      <div className="min-w-0 space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label
              htmlFor={`${idPrefix}-first-name`}
              className="block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              First Name
            </label>
            <input
              id={`${idPrefix}-first-name`}
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (errors.firstName) {
                  setErrors((prev) => ({ ...prev, firstName: '' }));
                }
              }}
              disabled={submitting}
              aria-required="true"
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={
                errors.firstName ? `${idPrefix}-first-name-err` : undefined
              }
              placeholder="e.g. Elena"
              className="mt-1.5 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 min-h-[42px]"
            />
            {errors.firstName ? (
              <p
                id={`${idPrefix}-first-name-err`}
                role="alert"
                className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.firstName}
              </p>
            ) : null}
          </div>

          <div className="min-w-0">
            <label
              htmlFor={`${idPrefix}-last-name`}
              className="block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              Last Name
            </label>
            <input
              id={`${idPrefix}-last-name`}
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (errors.lastName) {
                  setErrors((prev) => ({ ...prev, lastName: '' }));
                }
              }}
              disabled={submitting}
              aria-required="true"
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={
                errors.lastName ? `${idPrefix}-last-name-err` : undefined
              }
              placeholder="e.g. Vance"
              className="mt-1.5 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 min-h-[42px]"
            />
            {errors.lastName ? (
              <p
                id={`${idPrefix}-last-name-err`}
                role="alert"
                className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.lastName}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-dob`}
            className="block text-sm font-medium text-slate-800 dark:text-slate-200"
          >
            Date of Birth
          </label>
          <SegmentedDateInput
            id={`${idPrefix}-dob`}
            value={dateOfBirth}
            onChange={(nextVal) => {
              setDateOfBirth(nextVal);
              if (errors.dateOfBirth) {
                setErrors((prev) => ({ ...prev, dateOfBirth: '' }));
              }
            }}
            disabled={submitting}
            invalid={Boolean(errors.dateOfBirth)}
            describedBy={
              errors.dateOfBirth ? `${idPrefix}-dob-err` : undefined
            }
          />
          {errors.dateOfBirth ? (
            <p
              id={`${idPrefix}-dob-err`}
              role="alert"
              className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
            >
              {errors.dateOfBirth}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <GoogleRecaptchaWidget
          token={recaptchaToken}
          onTokenChange={(t) => {
            setRecaptchaToken(t);
            if (errors.recaptcha) {
              setErrors((prev) => ({ ...prev, recaptcha: '' }));
            }
          }}
          error={errors.recaptcha}
          resetSignal={recaptchaResetSignal}
        />
      </div>

      {serverError ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
        >
          {serverError}
        </p>
      ) : null}

      <div className="pt-1">
        {onCancel ? (
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[44px]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60 whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[44px]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserCheck className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{submitting ? 'Checking Record...' : submitLabel}</span>
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60 min-h-[42px] sm:min-h-[44px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserCheck className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{submitting ? 'Checking Record...' : submitLabel}</span>
          </button>
        )}
      </div>

      {quickSamples.length > 0 ? (
        <div className="border-t border-slate-200 pt-3.5 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick fill sample patient:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickSamples.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => handleFillSample(sample)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 min-h-[36px]"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
