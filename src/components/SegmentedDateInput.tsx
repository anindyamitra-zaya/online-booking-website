import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { parseMmDdYyyyToIso } from '../utils/appointments';

interface SegmentedDateInputProps {
  id: string;
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

function splitDateParts(raw: string): { mm: string; dd: string; yyyy: string } {
  const trimmed = (raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('-');
    return { mm, dd, yyyy };
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [mm, dd, yyyy] = trimmed.split('-');
    return { mm, dd, yyyy };
  }
  return { mm: '', dd: '', yyyy: '' };
}

export function SegmentedDateInput({
  id,
  value,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
}: SegmentedDateInputProps) {
  const initial = splitDateParts(value);
  const [mm, setMm] = useState(initial.mm);
  const [dd, setDd] = useState(initial.dd);
  const [yyyy, setYyyy] = useState(initial.yyyy);

  const mmRef = useRef<HTMLInputElement | null>(null);
  const ddRef = useRef<HTMLInputElement | null>(null);
  const yyyyRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      setMm('');
      setDd('');
      setYyyy('');
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || /^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const next = splitDateParts(trimmed);
      setMm(next.mm);
      setDd(next.dd);
      setYyyy(next.yyyy);
    }
  }, [value]);

  const emitCombined = (nextMm: string, nextDd: string, nextYyyy: string) => {
    if (!nextMm && !nextDd && !nextYyyy) {
      onChange('');
      return;
    }
    if (nextMm.length === 2 && nextDd.length === 2 && nextYyyy.length === 4) {
      const mmDdYyyy = `${nextMm}-${nextDd}-${nextYyyy}`;
      const iso = parseMmDdYyyyToIso(mmDdYyyy);
      onChange(iso || mmDdYyyy);
      return;
    }
    onChange(`${nextMm}-${nextDd}-${nextYyyy}`);
  };

  const applyPastedDate = (raw: string): boolean => {
    const cleaned = raw.trim();
    const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const nextYyyy = isoMatch[1];
      const nextMm = isoMatch[2].padStart(2, '0');
      const nextDd = isoMatch[3].padStart(2, '0');
      setMm(nextMm);
      setDd(nextDd);
      setYyyy(nextYyyy);
      emitCombined(nextMm, nextDd, nextYyyy);
      return true;
    }
    const usMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (usMatch) {
      const nextMm = usMatch[1].padStart(2, '0');
      const nextDd = usMatch[2].padStart(2, '0');
      const nextYyyy = usMatch[3];
      setMm(nextMm);
      setDd(nextDd);
      setYyyy(nextYyyy);
      emitCombined(nextMm, nextDd, nextYyyy);
      return true;
    }
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 8) {
      const nextMm = digits.slice(0, 2);
      const nextDd = digits.slice(2, 4);
      const nextYyyy = digits.slice(4, 8);
      setMm(nextMm);
      setDd(nextDd);
      setYyyy(nextYyyy);
      emitCombined(nextMm, nextDd, nextYyyy);
      return true;
    }
    return false;
  };

  const isoValue = parseMmDdYyyyToIso(value) || '';

  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-2 sm:gap-2.5">
      <div
        data-testid={`${id}-segmented-box`}
        className={`flex min-w-0 flex-1 items-center rounded-lg border bg-white px-2 sm:px-3 min-h-[44px] transition-colors focus-within:ring-2 dark:bg-slate-950 ${
          invalid
            ? 'border-rose-500 focus-within:border-rose-600 focus-within:ring-rose-500/20 dark:border-rose-500'
            : 'border-slate-300 focus-within:border-brand-primary focus-within:ring-brand-ring dark:border-slate-700 dark:focus-within:border-brand-primary'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          id={id}
          ref={mmRef}
          type="text"
          inputMode="numeric"
          autoComplete="bday-month"
          maxLength={2}
          value={mm}
          disabled={disabled}
          aria-label="Birth month (MM)"
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          placeholder="MM"
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (applyPastedDate(text)) {
              e.preventDefault();
            }
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
            setMm(digits);
            emitCombined(digits, dd, yyyy);
            if (digits.length === 2) {
              ddRef.current?.focus();
              ddRef.current?.select();
            }
          }}
          className="w-1/4 min-w-0 bg-transparent text-center font-mono text-sm tracking-wide text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
        />

        <span
          aria-hidden="true"
          className="select-none px-1 font-mono text-sm text-slate-400 dark:text-slate-500"
        >
          -
        </span>

        <input
          id={`${id}-dd`}
          ref={ddRef}
          type="text"
          inputMode="numeric"
          autoComplete="bday-day"
          maxLength={2}
          value={dd}
          disabled={disabled}
          aria-label="Birth day (DD)"
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          placeholder="DD"
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !dd) {
              e.preventDefault();
              mmRef.current?.focus();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (applyPastedDate(text)) {
              e.preventDefault();
            }
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
            setDd(digits);
            emitCombined(mm, digits, yyyy);
            if (digits.length === 2) {
              yyyyRef.current?.focus();
              yyyyRef.current?.select();
            }
          }}
          className="w-1/4 min-w-0 bg-transparent text-center font-mono text-sm tracking-wide text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
        />

        <span
          aria-hidden="true"
          className="select-none px-1 font-mono text-sm text-slate-400 dark:text-slate-500"
        >
          -
        </span>

        <input
          id={`${id}-yyyy`}
          ref={yyyyRef}
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          value={yyyy}
          disabled={disabled}
          aria-label="Birth year (YYYY)"
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          placeholder="YYYY"
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !yyyy) {
              e.preventDefault();
              ddRef.current?.focus();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (applyPastedDate(text)) {
              e.preventDefault();
            }
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
            setYyyy(digits);
            emitCombined(mm, dd, digits);
          }}
          className="w-2/5 min-w-0 bg-transparent text-center font-mono text-sm tracking-wide text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
        />
      </div>

      <div
        className={`relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border bg-white text-brand-text transition-colors hover:bg-slate-50 focus-within:ring-2 focus-within:ring-brand-ring focus-within:border-brand-primary dark:bg-slate-950 dark:text-brand-text-dark dark:hover:bg-slate-900 ${
          invalid
            ? 'border-rose-500 dark:border-rose-500'
            : 'border-slate-300 dark:border-slate-700'
        } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <Calendar className="h-4 w-4 pointer-events-none" aria-hidden="true" />
        <input
          ref={pickerRef}
          type="date"
          tabIndex={disabled ? -1 : 0}
          aria-label="Open date of birth calendar picker"
          value={isoValue}
          disabled={disabled}
          min="1900-01-01"
          max="2099-12-31"
          onClick={() => {
            try {
              pickerRef.current?.showPicker?.();
            } catch {}
          }}
          onChange={(e) => {
            const pickedIso = e.target.value;
            if (!pickedIso) return;
            const parts = splitDateParts(pickedIso);
            setMm(parts.mm);
            setDd(parts.dd);
            setYyyy(parts.yyyy);
            onChange(pickedIso);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
