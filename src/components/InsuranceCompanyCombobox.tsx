import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import {
  computeDropdownPlacement,
  filterInsuranceCompanies,
} from '../utils/appointments';

interface InsuranceCompanyComboboxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  companies: string[];
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  errorId?: string;
  placeholder?: string;
}

export function InsuranceCompanyCombobox({
  id,
  label,
  value,
  onChange,
  companies,
  loading = false,
  disabled = false,
  error,
  errorId,
  placeholder = 'Search company...',
}: InsuranceCompanyComboboxProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuLayout, setMenuLayout] = useState<{
    placement: 'top' | 'bottom';
    maxHeight: number;
  }>({ placement: 'bottom', maxHeight: 192 });

  const filtered = filterInsuranceCompanies(companies, value);

  const updateMenuPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setMenuLayout(
      computeDropdownPlacement(rect.top, rect.bottom, window.innerHeight, 192, 16)
    );
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !listRef.current) return;
    const activeEl = listRef.current.children[activeIndex] as
      | HTMLElement
      | undefined;
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, activeIndex]);

  const handleSelectOption = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else if (filtered.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen && filtered.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter' && isOpen && activeIndex >= 0) {
      const chosen = filtered[activeIndex];
      if (chosen) {
        e.preventDefault();
        handleSelectOption(chosen);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0 w-full">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-800 dark:text-slate-200"
      >
        {label}
      </label>

      <div className="relative mt-1.5 min-w-0">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && activeIndex >= 0 && filtered[activeIndex]
              ? `${listboxId}-opt-${activeIndex}`
              : undefined
          }
          aria-required="true"
          aria-invalid={Boolean(error)}
          aria-describedby={error && errorId ? errorId : undefined}
          value={value}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full min-w-0 rounded-lg border border-slate-300 bg-white pl-3 ${
            value && !disabled ? 'pr-14' : 'pr-8'
          } py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 h-[44px]`}
        />

        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {loading ? (
            <Loader2
              className="mr-1 h-3.5 w-3.5 animate-spin text-brand-text dark:text-brand-text-dark"
              aria-hidden="true"
            />
          ) : null}

          {value && !disabled ? (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(true);
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              aria-label="Clear insurance company"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}

          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            aria-label="Toggle insurance companies list"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                isOpen ? 'rotate-180 text-brand-text dark:text-brand-text-dark' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        {isOpen ? (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Insurance companies"
            style={{ maxHeight: `${menuLayout.maxHeight}px` }}
            className={`absolute left-0 right-0 z-40 w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
              menuLayout.placement === 'top'
                ? 'bottom-full mb-1.5'
                : 'top-full mt-1.5'
            }`}
          >
            {loading && companies.length === 0 ? (
              <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Loading insurance companies...</span>
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                No matching companies found. Your entered name will be saved.
              </li>
            ) : (
              filtered.map((company, idx) => {
                const isSelected =
                  company.toLowerCase() === value.trim().toLowerCase();
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={company}
                    id={`${listboxId}-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    title={company}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectOption(company);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                      isSelected
                        ? 'bg-brand-soft-bg font-semibold text-brand-text dark:bg-brand-soft-bg-dark dark:text-brand-text-dark'
                        : isActive
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                          : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{company}</span>
                    {isSelected ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-brand-text dark:text-brand-text-dark"
                        aria-hidden="true"
                      />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
