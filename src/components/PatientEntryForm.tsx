import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, UserCheck, UserPlus } from 'lucide-react';
import type { ClinicSamplePatient, PatientProfile } from '../types/clinic';
import {
  fetchInsuranceCompanies,
  lookupPatient,
  registerPatient,
} from '../services/clinicApi';
import { DEFAULT_INSURANCE_COMPANIES } from '../data/insuranceCompanies';
import { US_STATES } from '../data/usStates';
import {
  formatDateLabel,
  validatePatientLookup,
  validatePatientRegistration,
} from '../utils/appointments';
import { InsuranceCompanyCombobox } from './InsuranceCompanyCombobox';
import { ThemedSelect } from './ThemedSelect';

interface PatientEntryFormProps {
  idPrefix?: string;
  submitLabel?: string;
  samplePatients?: ClinicSamplePatient[];
  onPatientReady: (
    patient: PatientProfile,
    kind: 'established' | 'new'
  ) => Promise<void> | void;
  onCancel?: () => void;
}

export function PatientEntryForm({
  idPrefix = 'patient',
  submitLabel = 'Continue',
  samplePatients,
  onPatientReady,
  onCancel,
}: PatientEntryFormProps) {
  const quickSamples = samplePatients ?? [];
  const [stage, setStage] = useState<'lookup' | 'register'>('lookup');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [pin, setPin] = useState('');
  const [paymentType, setPaymentType] = useState<'insurance' | 'self-pay'>(
    'insurance'
  );
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceMemberId, setInsuranceMemberId] = useState('');
  const [insuranceCompanies, setInsuranceCompanies] = useState<string[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (stage !== 'register' || insuranceCompanies.length > 0) return;
    let cancelled = false;
    setLoadingCompanies(true);

    fetchInsuranceCompanies()
      .then((list) => {
        if (!cancelled) {
          setInsuranceCompanies(
            list.length > 0 ? list : DEFAULT_INSURANCE_COMPANIES
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInsuranceCompanies(DEFAULT_INSURANCE_COMPANIES);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCompanies(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stage, insuranceCompanies.length]);

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePatientLookup(fullName, dateOfBirth);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setErrors({});
    setServerError('');
    setSubmitting(true);
    try {
      const result = await lookupPatient({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth.trim(),
      });

      if (result.found && result.patient) {
        await onPatientReady(result.patient, 'established');
      } else {
        setStage('register');
      }
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Unable to check patient record. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePatientRegistration({
      fullName,
      dateOfBirth,
      phone,
      age,
      sex,
      street,
      city,
      state: stateVal,
      pin,
      paymentType,
      insuranceProvider,
      insuranceMemberId,
    });
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setErrors({});
    setServerError('');
    setSubmitting(true);
    try {
      const created = await registerPatient({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth.trim(),
        phone: phone.trim(),
        sex: sex.trim(),
        street: street.trim(),
        city: city.trim(),
        state: stateVal.trim(),
        pin: pin.trim(),
        insuranceProvider:
          paymentType === 'insurance' ? insuranceProvider.trim() : 'Self-Pay',
        memberId:
          paymentType === 'insurance' ? insuranceMemberId.trim() : 'SELF-PAY',
      });
      await onPatientReady(created, 'new');
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Unable to complete patient registration. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillSample = (sample: ClinicSamplePatient) => {
    setStage('lookup');
    setFullName(sample.fullName);
    setDateOfBirth(sample.dateOfBirth);
    setPhone('');
    setAge('');
    setSex('');
    setStreet('');
    setCity('');
    setStateVal('');
    setPin('');
    setPaymentType('insurance');
    setInsuranceProvider('');
    setInsuranceMemberId('');
    setErrors({});
    setServerError('');
  };

  if (stage === 'register') {
    return (
      <form onSubmit={handleRegisterSubmit} className="space-y-3.5" noValidate>
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-2.5 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100"
        >
          <UserPlus
            className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold text-xs">New Patient Registration</p>
            <p className="mt-0.5 text-xs text-teal-900/90 dark:text-teal-200/90">
              No existing record found for{' '}
              <span className="font-semibold">{fullName.trim()}</span> (
              <span className="font-mono tabular-nums">
                {formatDateLabel(dateOfBirth.trim())}
              </span>
              ). Please complete your registration details below.
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="min-w-0">
            <label
              htmlFor={`${idPrefix}-reg-full-name`}
              className="block text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              Full Name
            </label>
            <input
              id={`${idPrefix}-reg-full-name`}
              type="text"
              value={fullName}
              disabled
              readOnly
              className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 min-h-[36px]"
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor={`${idPrefix}-reg-dob`}
              className="block text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              Date of Birth
            </label>
            <input
              id={`${idPrefix}-reg-dob`}
              type="text"
              value={formatDateLabel(dateOfBirth)}
              disabled
              readOnly
              className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-mono font-medium tabular-nums text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 min-h-[36px]"
            />
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="min-w-0">
            <label
              htmlFor={`${idPrefix}-reg-phone`}
              className="block text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              Mobile Phone
            </label>
            <input
              id={`${idPrefix}-reg-phone`}
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) {
                  setErrors((prev) => ({ ...prev, phone: '' }));
                }
              }}
              disabled={submitting}
              aria-required="true"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={
                errors.phone ? `${idPrefix}-reg-phone-err` : undefined
              }
              placeholder="(512) 555-0199"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[36px]"
            />
            {errors.phone ? (
              <p
                id={`${idPrefix}-reg-phone-err`}
                role="alert"
                className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.phone}
              </p>
            ) : null}
          </div>

          <div className="min-w-0">
            <label
              htmlFor={`${idPrefix}-reg-age`}
              className="block text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              Age
            </label>
            <input
              id={`${idPrefix}-reg-age`}
              type="number"
              min="0"
              max="120"
              value={age}
              onChange={(e) => {
                setAge(e.target.value);
                if (errors.age) {
                  setErrors((prev) => ({ ...prev, age: '' }));
                }
              }}
              disabled={submitting}
              aria-required="true"
              aria-invalid={Boolean(errors.age)}
              aria-describedby={
                errors.age ? `${idPrefix}-reg-age-err` : undefined
              }
              placeholder="e.g. 36"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[36px]"
            />
            {errors.age ? (
              <p
                id={`${idPrefix}-reg-age-err`}
                role="alert"
                className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.age}
              </p>
            ) : null}
          </div>

          <div className="min-w-0">
            <label
              id={`${idPrefix}-reg-sex-label`}
              onClick={() =>
                document.getElementById(`${idPrefix}-reg-sex`)?.focus()
              }
              className="block text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              Sex
            </label>
            <ThemedSelect
              id={`${idPrefix}-reg-sex`}
              labelId={`${idPrefix}-reg-sex-label`}
              value={sex}
              onChange={(val) => {
                setSex(val);
                if (errors.sex) {
                  setErrors((prev) => ({ ...prev, sex: '' }));
                }
              }}
              options={[
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
                { value: 'Other', label: 'Other' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]}
              placeholder="Select sex"
              disabled={submitting}
              required
              invalid={Boolean(errors.sex)}
              describedBy={errors.sex ? `${idPrefix}-reg-sex-err` : undefined}
              size="xs"
            />
            {errors.sex ? (
              <p
                id={`${idPrefix}-reg-sex-err`}
                role="alert"
                className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.sex}
              </p>
            ) : null}
          </div>
        </div>

        <fieldset className="min-w-0 space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <legend className="px-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
            Address
          </legend>
          <div className="min-w-0">
            <label
              htmlFor={`${idPrefix}-reg-street`}
              className="block text-[11px] font-medium text-slate-700 dark:text-slate-300"
            >
              Street Address
            </label>
            <input
              id={`${idPrefix}-reg-street`}
              type="text"
              autoComplete="street-address"
              value={street}
              onChange={(e) => {
                setStreet(e.target.value);
                if (errors.address) {
                  setErrors((prev) => ({ ...prev, address: '' }));
                }
              }}
              disabled={submitting}
              aria-required="true"
              placeholder="e.g. 100 Main St"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[34px]"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="min-w-0">
              <label
                htmlFor={`${idPrefix}-reg-city`}
                className="block text-[11px] font-medium text-slate-700 dark:text-slate-300"
              >
                City
              </label>
              <input
                id={`${idPrefix}-reg-city`}
                type="text"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (errors.address) {
                    setErrors((prev) => ({ ...prev, address: '' }));
                  }
                }}
                disabled={submitting}
                aria-required="true"
                placeholder="Austin"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[34px]"
              />
            </div>
            <div className="min-w-0">
              <label
                id={`${idPrefix}-reg-state-label`}
                onClick={() =>
                  document.getElementById(`${idPrefix}-reg-state`)?.focus()
                }
                className="block text-[11px] font-medium text-slate-700 dark:text-slate-300"
              >
                State
              </label>
              <ThemedSelect
                id={`${idPrefix}-reg-state`}
                labelId={`${idPrefix}-reg-state-label`}
                value={stateVal}
                onChange={(val) => {
                  setStateVal(val);
                  if (errors.address) {
                    setErrors((prev) => ({ ...prev, address: '' }));
                  }
                }}
                options={US_STATES.map((st) => ({
                  value: st.code,
                  label: `${st.name} (${st.code})`,
                }))}
                placeholder="Select state"
                disabled={submitting}
                required
                invalid={Boolean(errors.address && !stateVal)}
                size="xs"
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor={`${idPrefix}-reg-pin`}
                className="block text-[11px] font-medium text-slate-700 dark:text-slate-300"
              >
                Zip Code
              </label>
              <input
                id={`${idPrefix}-reg-pin`}
                type="text"
                autoComplete="postal-code"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (errors.address) {
                    setErrors((prev) => ({ ...prev, address: '' }));
                  }
                }}
                disabled={submitting}
                aria-required="true"
                placeholder="78756"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[36px]"
              />
            </div>
          </div>
          {errors.address ? (
            <p
              role="alert"
              className="text-[11px] font-medium text-rose-700 dark:text-rose-400"
            >
              {errors.address}
            </p>
          ) : null}
        </fieldset>

        <div>
          <label className="block text-xs font-medium text-slate-800 dark:text-slate-200">
            Payment Type
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentType('insurance')}
              aria-pressed={paymentType === 'insurance'}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors min-h-[38px] ${
                paymentType === 'insurance'
                  ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/60 dark:text-teal-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
              }`}
            >
              Insurance
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentType('self-pay');
                setErrors((prev) => ({
                  ...prev,
                  insuranceProvider: '',
                  insuranceMemberId: '',
                }));
              }}
              aria-pressed={paymentType === 'self-pay'}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors min-h-[38px] ${
                paymentType === 'self-pay'
                  ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/60 dark:text-teal-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
              }`}
            >
              Self-Pay
            </button>
          </div>
        </div>

        {paymentType === 'insurance' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <InsuranceCompanyCombobox
              id={`${idPrefix}-reg-ins-company`}
              label="Insurance Company"
              value={insuranceProvider}
              onChange={(val) => {
                setInsuranceProvider(val);
                if (errors.insuranceProvider) {
                  setErrors((prev) => ({ ...prev, insuranceProvider: '' }));
                }
              }}
              companies={insuranceCompanies}
              loading={loadingCompanies}
              disabled={submitting}
              error={errors.insuranceProvider}
              errorId={`${idPrefix}-reg-ins-company-err`}
            />

            <div className="min-w-0">
              <label
                htmlFor={`${idPrefix}-reg-ins-member`}
                className="block text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                Insurance Member ID
              </label>
              <input
                id={`${idPrefix}-reg-ins-member`}
                type="text"
                value={insuranceMemberId}
                onChange={(e) => {
                  setInsuranceMemberId(e.target.value);
                  if (errors.insuranceMemberId) {
                    setErrors((prev) => ({ ...prev, insuranceMemberId: '' }));
                  }
                }}
                disabled={submitting}
                aria-required="true"
                aria-invalid={Boolean(errors.insuranceMemberId)}
                aria-describedby={
                  errors.insuranceMemberId
                    ? `${idPrefix}-reg-ins-member-err`
                    : undefined
                }
                placeholder="e.g. BCB-884120"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[38px]"
              />
              {errors.insuranceMemberId ? (
                <p
                  id={`${idPrefix}-reg-ins-member-err`}
                  role="alert"
                  className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-400"
                >
                  {errors.insuranceMemberId}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {serverError ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
          >
            {serverError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setStage('lookup');
              setErrors({});
              setServerError('');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 min-h-[38px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 min-h-[38px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            <span>
              {submitting
                ? 'Registering Patient...'
                : 'Complete Registration & Continue'}
            </span>
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleLookupSubmit} className="space-y-3.5" noValidate>
      <div className="space-y-3.5">
        <div>
          <label
            htmlFor={`${idPrefix}-full-name`}
            className="block text-sm font-medium text-slate-800 dark:text-slate-200"
          >
            Full Name
          </label>
          <input
            id={`${idPrefix}-full-name`}
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) {
                setErrors((prev) => ({ ...prev, fullName: '' }));
              }
            }}
            disabled={submitting}
            aria-required="true"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={
              errors.fullName ? `${idPrefix}-name-err` : undefined
            }
            placeholder="e.g. Elena Vance"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[42px]"
          />
          {errors.fullName ? (
            <p
              id={`${idPrefix}-name-err`}
              role="alert"
              className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
            >
              {errors.fullName}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-dob`}
            className="block text-sm font-medium text-slate-800 dark:text-slate-200"
          >
            Date of Birth
          </label>
          <input
            id={`${idPrefix}-dob`}
            type="date"
            autoComplete="bday"
            value={dateOfBirth}
            onChange={(e) => {
              setDateOfBirth(e.target.value);
              if (errors.dateOfBirth) {
                setErrors((prev) => ({ ...prev, dateOfBirth: '' }));
              }
            }}
            disabled={submitting}
            aria-required="true"
            aria-invalid={Boolean(errors.dateOfBirth)}
            aria-describedby={
              errors.dateOfBirth ? `${idPrefix}-dob-err` : undefined
            }
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-h-[42px]"
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

      {serverError ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
        >
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 min-h-[44px]"
          >
            Cancel
          </button>
        ) : (
          <span />
        )}

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className={`inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 min-h-[44px] ${
            onCancel ? '' : 'w-full'
          }`}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserCheck className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{submitting ? 'Checking Record...' : submitLabel}</span>
        </button>
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
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 min-h-[36px]"
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
