import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, ShieldCheck } from 'lucide-react';
import {
  createPreviewRecaptchaToken,
  fetchRecaptchaConfig,
} from '../services/clinicApi';

interface GoogleRecaptchaWidgetProps {
  token: string;
  onTokenChange: (token: string) => void;
  error?: string;
  resetSignal?: number;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready?: (cb: () => void) => void;
      render: (
        container: HTMLElement,
        params: {
          sitekey: string;
          theme?: 'light' | 'dark';
          size?: 'normal' | 'compact';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Browser window unavailable.'));
  }
  if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
    return Promise.resolve();
  }
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-google-recaptcha="true"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google reCAPTCHA script.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.googleRecaptcha = 'true';
    script.onload = () => {
      if (window.grecaptcha?.ready) {
        window.grecaptcha.ready(() => resolve());
      } else {
        resolve();
      }
    };
    script.onerror = () => {
      googleScriptPromise = null;
      reject(new Error('Failed to load Google reCAPTCHA script.'));
    };
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function GoogleRecaptchaWidget({
  token,
  onTokenChange,
  error,
  resetSignal = 0,
}: GoogleRecaptchaWidgetProps) {
  const [config, setConfig] = useState<{
    mode: 'google' | 'preview';
    siteKey: string | null;
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [verifyingPreview, setVerifyingPreview] = useState(false);
  const [widgetLoadError, setWidgetLoadError] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  useEffect(() => {
    let cancelled = false;
    fetchRecaptchaConfig()
      .then((res) => {
        if (!cancelled) {
          setConfig(res);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfig({ mode: 'preview', siteKey: null });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingConfig(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Render real Google reCAPTCHA v2 checkbox when VITE_RECAPTCHA_SITE_KEY + RECAPTCHA_SECRET_KEY are configured
  useEffect(() => {
    if (!config || config.mode !== 'google' || !config.siteKey) return;
    let cancelled = false;

    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');
    const isNarrow =
      typeof window !== 'undefined' && window.innerWidth < 380;

    loadGoogleRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        containerRef.current.innerHTML = '';
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: config.siteKey as string,
          theme: isDark ? 'dark' : 'light',
          size: isNarrow ? 'compact' : 'normal',
          callback: (nextToken: string) => {
            onTokenChangeRef.current(nextToken);
          },
          'expired-callback': () => {
            onTokenChangeRef.current('');
          },
          'error-callback': () => {
            onTokenChangeRef.current('');
          },
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setWidgetLoadError(
            err instanceof Error
              ? err.message
              : 'Unable to load Google reCAPTCHA.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config]);

  useEffect(() => {
    if (resetSignal === 0) return;
    if (
      config?.mode === 'google' &&
      widgetIdRef.current !== null &&
      window.grecaptcha
    ) {
      window.grecaptcha.reset(widgetIdRef.current);
    }
    onTokenChangeRef.current('');
  }, [resetSignal, config?.mode]);

  const handleTogglePreview = async () => {
    if (verifyingPreview) return;
    if (token) {
      onTokenChange('');
      return;
    }
    setVerifyingPreview(true);
    setWidgetLoadError('');
    try {
      const res = await createPreviewRecaptchaToken();
      onTokenChange(res.token);
    } catch (err) {
      setWidgetLoadError(
        err instanceof Error
          ? err.message
          : 'Unable to verify reCAPTCHA challenge.'
      );
      onTokenChange('');
    } finally {
      setVerifyingPreview(false);
    }
  };

  const displayError = error || widgetLoadError;

  return (
    <div data-testid="recaptcha-box" className="space-y-1.5">
      {loadingConfig ? (
        <div className="flex h-[74px] w-full max-w-[304px] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-900">
          <Loader2
            className="h-5 w-5 animate-spin text-teal-700 dark:text-teal-400"
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Loading verification...
          </span>
        </div>
      ) : config?.mode === 'google' && config.siteKey ? (
        <div className="max-w-full overflow-x-auto">
          <div ref={containerRef} className="inline-block" />
        </div>
      ) : (
        <div
          className={`flex w-full max-w-[320px] items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
            displayError
              ? 'border-rose-400 bg-rose-50/50 dark:border-rose-700 dark:bg-rose-950/30'
              : token
                ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-slate-300 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-950/70'
          }`}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={Boolean(token)}
            aria-label="I'm not a robot"
            data-testid="recaptcha-checkbox-button"
            disabled={verifyingPreview}
            onClick={handleTogglePreview}
            className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                token
                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950'
                  : 'border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-900'
              }`}
            >
              {verifyingPreview ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-teal-700 dark:text-teal-300"
                  aria-hidden="true"
                />
              ) : token ? (
                <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
              ) : null}
            </span>
            <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100">
              I&apos;m not a robot
            </span>
          </button>

          <div className="flex shrink-0 flex-col items-center text-center leading-tight">
            <ShieldCheck
              className="h-5 w-5 text-teal-700 dark:text-teal-400"
              aria-hidden="true"
            />
            <span className="mt-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              reCAPTCHA
            </span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500">
              Protected
            </span>
          </div>
        </div>
      )}

      {displayError ? (
        <p
          role="alert"
          className="text-xs font-medium text-rose-700 dark:text-rose-400"
        >
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
