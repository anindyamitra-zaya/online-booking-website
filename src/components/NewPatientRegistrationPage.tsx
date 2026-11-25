import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import type { ClinicProfile, PatientProfile } from '../types/clinic';
import {
  fetchInsuranceCompanies,
  registerPatient,
} from '../services/clinicApi';
import { DEFAULT_INSURANCE_COMPANIES } from '../data/insuranceCompanies';
import { US_LANGUAGES } from '../data/usLanguages';
import { US_STATES } from '../data/usStates';
import {
  formatDateLabel,
  validatePatientRegistration,
} from '../utils/appointments';
import { InsuranceCompanyCombobox } from './InsuranceCompanyCombobox';
import { ThemedSelect } from './ThemedSelect';

export interface VerifiedRegistrationSeed {
  fullName: string;
  dateOfBirth: string;
  phone: string;
  phoneVerificationToken: string;
}

interface NewPatientRegistrationPageProps {
  clinic: ClinicProfile;
  seed: VerifiedRegistrationSeed;
  onRegistered: (
    patient: PatientProfile,
    kind: 'new'
  ) => Promise<void> | void;
  onBack: () => void;
}

export function NewPatientRegistrationPage({
  clinic,
  seed,
  onRegistered,
  onBack,
}: NewPatientRegistrationPageProps) {
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
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
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePatientRegistration({
      fullName: seed.fullName,
      dateOfBirth: seed.dateOfBirth,
      phone: seed.phone,
      age,
      sex,
      preferredLanguage,
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
        fullName: seed.fullName.trim(),
        dateOfBirth: seed.dateOfBirth.trim(),
        phone: seed.phone.trim(),
        phoneVerificationToken: seed.phoneVerificationToken,
        sex: sex.trim(),
        preferredLanguage: preferredLanguage.trim(),
        street: street.trim(),
        city: city.trim(),
        state: stateVal.trim(),
        pin: pin.trim(),
        insuranceProvider:
          paymentType === 'insurance' ? insuranceProvider.trim() : 'Self-Pay',
        memberId:
          paymentType === 'insurance' ? insuranceMemberId.trim() : 'SELF-PAY',
      });
      await onRegistered(created, 'new');
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

  return (
    <div className="w-full pb-8">
      <section
        aria-labelledby="reg-page-heading"
        data-testid="registration-page-card"
        className="w-full rounded-xl border border-slate-200 bg-white p-4 sm:p-7 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            {clinic.shortName} · New Patient Onboarding
          </p>
          <h1
            id="reg-page-heading"
            className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
          >
            New Patient Registration
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <label
                htmlFor="reg-page-full-name"
                className="block text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                Full Name
              </label>
              <input
                id="reg-page-full-name"
                type="text"
                value={seed.fullName}
                disabled
                readOnly
                className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 h-[44px]"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="reg-page-dob"
                className="block text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                Date of Birth
              </label>
              <input
                id="reg-page-dob"
                type="text"
                value={formatDateLabel(seed.dateOfBirth)}
                disabled
                readOnly
                className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-mono font-medium tabular-nums text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 h-[44px]"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center justify-between gap-1">
                <label
                  htmlFor="reg-page-phone"
                  className="block text-xs font-medium text-slate-800 dark:text-slate-200"
                >
                  Mobile Phone
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>Verified</span>
                </span>
              </div>
              <input
                id="reg-page-phone"
                type="tel"
                value={seed.phone}
                disabled
                readOnly
                className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-mono font-medium tabular-nums text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="min-w-0">
              <label
                htmlFor="reg-page-age"
                className="block text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                Age
              </label>
              <input
                id="reg-page-age"
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
                aria-describedby={errors.age ? 'reg-page-age-err' : undefined}
                placeholder="e.g. 36"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 h-[44px]"
              />
              {errors.age ? (
                <p
                  id="reg-page-age-err"
                  role="alert"
                  className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                >
                  {errors.age}
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <label
                id="reg-page-sex-label"
                onClick={() =>
                  document.getElementById('reg-page-sex')?.focus()
                }
                className="block text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                Sex
              </label>
              <ThemedSelect
                id="reg-page-sex"
                labelId="reg-page-sex-label"
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
                describedBy={errors.sex ? 'reg-page-sex-err' : undefined}
                size="sm"
              />
              {errors.sex ? (
                <p
                  id="reg-page-sex-err"
                  role="alert"
                  className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                >
                  {errors.sex}
                </p>
              ) : null}
            </div>

            <div className="col-span-2 min-w-0 sm:col-span-1">
              <label
                id="reg-page-language-label"
                onClick={() =>
                  document.getElementById('reg-page-language')?.focus()
                }
                className="block text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                Preferred Language
              </label>
              <ThemedSelect
                id="reg-page-language"
                labelId="reg-page-language-label"
                value={preferredLanguage}
                onChange={(val) => {
                  setPreferredLanguage(val);
                  if (errors.preferredLanguage) {
                    setErrors((prev) => ({ ...prev, preferredLanguage: '' }));
                  }
                }}
                options={US_LANGUAGES.map((lang) => ({
                  value: lang,
                  label: lang,
                }))}
                placeholder="Select language"
                disabled={submitting}
                required
                invalid={Boolean(errors.preferredLanguage)}
                describedBy={
                  errors.preferredLanguage ? 'reg-page-language-err' : undefined
                }
                size="sm"
              />
              {errors.preferredLanguage ? (
                <p
                  id="reg-page-language-err"
                  role="alert"
                  className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
                >
                  {errors.preferredLanguage}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Home Address
            </legend>

            <div className="min-w-0">
              <label
                htmlFor="reg-page-street"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Street Address
              </label>
              <input
                id="reg-page-street"
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
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <label
                  htmlFor="reg-page-city"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  City
                </label>
                <input
                  id="reg-page-city"
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
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 h-[44px]"
                />
              </div>

              <div className="min-w-0">
                <label
                  id="reg-page-state-label"
                  onClick={() =>
                    document.getElementById('reg-page-state')?.focus()
                  }
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  State
                </label>
                <ThemedSelect
                  id="reg-page-state"
                  labelId="reg-page-state-label"
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
                  size="sm"
                />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="reg-page-pin"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Zip Code
                </label>
                <input
                  id="reg-page-pin"
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
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 h-[44px]"
                />
              </div>
            </div>

            {errors.address ? (
              <p
                role="alert"
                className="text-xs font-medium text-rose-700 dark:text-rose-400"
              >
                {errors.address}
              </p>
            ) : null}
          </fieldset>

          <div>
            <label className="block text-xs font-medium text-slate-800 dark:text-slate-200">
              Payment Type
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setPaymentType('insurance')}
                aria-pressed={paymentType === 'insurance'}
                className={`rounded-lg border px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm font-semibold transition-colors h-[42px] sm:h-[44px] ${
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
                className={`rounded-lg border px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm font-semibold transition-colors h-[42px] sm:h-[44px] ${
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
            <div className="grid gap-4 sm:grid-cols-2">
              <InsuranceCompanyCombobox
                id="reg-page-ins-company"
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
                errorId="reg-page-ins-company-err"
              />

              <div className="min-w-0">
                <label
                  htmlFor="reg-page-ins-member"
                  className="block text-xs font-medium text-slate-800 dark:text-slate-200"
                >
                  Insurance Member ID
                </label>
                <input
                  id="reg-page-ins-member"
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
                      ? 'reg-page-ins-member-err'
                      : undefined
                  }
                  placeholder="e.g. BCB-884120"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 h-[44px]"
                />
                {errors.insuranceMemberId ? (
                  <p
                    id="reg-page-ins-member-err"
                    role="alert"
                    className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400"
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
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
            >
              {serverError}
            </p>
          ) : null}

          <div
            data-testid="registration-footer"
            className="flex flex-nowrap items-center justify-between gap-2 sm:gap-3 border-t border-slate-200 pt-4 sm:pt-5 dark:border-slate-800"
          >
            <button
              type="button"
              disabled={submitting}
              onClick={onBack}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[42px]"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Back</span>
            </button>

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs sm:px-6 sm:py-2.5 sm:text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[42px]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
              <span>
                {submitting ? (
                  'Registering...'
                ) : (
                  <>
                    <span className="sm:hidden">Register</span>
                    <span className="hidden sm:inline">
                      Complete Registration &amp; Continue
                    </span>
                  </>
                )}
              </span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
