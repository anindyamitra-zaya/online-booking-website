import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { computeDropdownPlacement } from '../utils/appointments';

export interface ThemedSelectOption {
  value: string;
  label: string;
}

interface ThemedSelectProps {
  id: string;
  labelId?: string;
  value: string;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  size?: 'xs' | 'sm';
  ariaLabel?: string;
}

export function ThemedSelect({
  id,
  labelId,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  invalid = false,
  describedBy,
  size = 'xs',
  ariaLabel,
}: ThemedSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuLayout, setMenuLayout] = useState<{
    placement: 'top' | 'bottom';
    maxHeight: number;
  }>({ placement: 'bottom', maxHeight: 224 });

  const selectedOption = options.find((opt) => opt.value === value);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuLayout(
      computeDropdownPlacement(rect.top, rect.bottom, window.innerHeight, 224, 16)
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

  const openMenu = () => {
    if (disabled) return;
    const currentIdx = options.findIndex((o) => o.value === value);
    setActiveIndex(currentIdx >= 0 ? currentIdx : 0);
    setIsOpen(true);
  };

  const selectOption = (opt: ThemedSelectOption) => {
    onChange(opt.value);
    setIsOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else if (options.length > 0) {
        setActiveIndex((prev) => (prev + 1) % options.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else if (options.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1));
      }
    } else if (e.key === 'Home' && isOpen) {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End' && isOpen) {
      e.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        openMenu();
      } else if (activeIndex >= 0 && options[activeIndex]) {
        selectOption(options[activeIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const char = e.key.toLowerCase();
      const start = isOpen && activeIndex >= 0 ? activeIndex + 1 : 0;
      const ordered = [...options.slice(start), ...options.slice(0, start)];
      const match = ordered.find((o) =>
        o.label.toLowerCase().startsWith(char)
      );
      if (match) {
        const matchIdx = options.indexOf(match);
        setActiveIndex(matchIdx);
        if (!isOpen) {
          onChange(match.value);
        }
      }
    }
  };

  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-2 text-sm h-[44px]'
      : 'px-2.5 py-1.5 text-xs min-h-[36px]';

  return (
    <div ref={containerRef} className="relative min-w-0 w-full">
      <div className="relative mt-1.5 min-w-0">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && activeIndex >= 0 && options[activeIndex]
              ? `${listboxId}-opt-${activeIndex}`
              : undefined
          }
          aria-labelledby={labelId}
          aria-label={ariaLabel}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
          onKeyDown={handleKeyDown}
          className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border text-left transition-colors ${sizeClasses} ${
            disabled
              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
              : isOpen
                ? 'border-teal-700 bg-white text-slate-900 ring-1 ring-teal-700 dark:border-teal-400 dark:bg-slate-950 dark:text-slate-100 dark:ring-teal-400'
                : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600'
          }`}
        >
          <span
            className={`min-w-0 flex-1 truncate ${
              selectedOption
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${
              isOpen ? 'rotate-180 text-teal-700 dark:text-teal-400' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {isOpen ? (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            aria-label={ariaLabel}
            style={{ maxHeight: `${menuLayout.maxHeight}px` }}
            className={`absolute left-0 right-0 z-40 w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
              menuLayout.placement === 'top'
                ? 'bottom-full mb-1.5'
                : 'top-full mt-1.5'
            }`}
          >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${listboxId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-teal-50 font-semibold text-teal-900 dark:bg-teal-950/70 dark:text-teal-100'
                    : isActive
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                {isSelected ? (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        ) : null}
      </div>
    </div>
  );
}
