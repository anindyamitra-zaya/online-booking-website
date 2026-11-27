import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { TimeSlot } from '../types/clinic';
import {
  formatDateWithWeekday,
  type CalendarDayCell,
  type CalendarMonthOption,
} from '../utils/appointments';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface CalendarSlotPickerProps {
  activeMonth: CalendarMonthOption;
  monthIndex: number;
  totalMonths: number;
  monthCells: CalendarDayCell[];
  selectedDate: string;
  selectedTime24: string;
  slots: TimeSlot[];
  loadingSlots: boolean;
  getDateSlotCount: (dateIso: string) => number;
  onMonthNavigate: (newIdx: number) => void;
  onSelectDate: (dateIso: string) => void;
  onSelectTime: (time24: string) => void;
  dateError?: string;
  timeError?: string;
  slotsHeading?: string;
  emptySlotsMessage?: string;
  variant?: 'wizard' | 'modal';
}

export function CalendarSlotPicker({
  activeMonth,
  monthIndex,
  totalMonths,
  monthCells,
  selectedDate,
  selectedTime24,
  slots,
  loadingSlots,
  getDateSlotCount,
  onMonthNavigate,
  onSelectDate,
  onSelectTime,
  dateError,
  timeError,
  slotsHeading = 'Available Times',
  emptySlotsMessage = 'No open clinic slots on this date. Please choose another day.',
  variant = 'wizard',
}: CalendarSlotPickerProps) {
  const morningSlots = slots.filter(
    (s) => s.period === 'morning' && s.available
  );
  const afternoonSlots = slots.filter(
    (s) => s.period === 'afternoon' && s.available
  );

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-12 lg:items-start">
      <div className="min-w-0 lg:col-span-7">
        <div className="flex items-center justify-between gap-2 pb-2">
          <span
            data-testid={variant === 'wizard' ? 'calendar-month-title' : undefined}
            className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50"
          >
            {activeMonth.label}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={monthIndex === 0}
              onClick={() => onMonthNavigate(monthIndex - 1)}
              aria-label="Previous month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={monthIndex >= totalMonths - 1}
              onClick={() => onMonthNavigate(monthIndex + 1)}
              aria-label="Next month"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
              >
                {day}
              </span>
            ))}
          </div>

          <div
            data-testid={variant === 'wizard' ? 'month-calendar-grid' : undefined}
            className="grid grid-cols-7 gap-1"
          >
            {monthCells.map((cell, idx) => {
              if (!cell.inCurrentMonth || !cell.dateIso || !cell.dayNumber) {
                return (
                  <div
                    key={`empty-${idx}`}
                    aria-hidden="true"
                    className={variant === 'wizard' ? 'h-9 sm:h-[38px]' : 'min-h-[40px]'}
                  />
                );
              }

              const dateIso = cell.dateIso;
              const count = cell.inWindow ? getDateSlotCount(dateIso) : 0;
              const isDisabled = !cell.inWindow || count === 0;
              const isSelected = selectedDate === dateIso;

              return (
                <button
                  key={dateIso}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      onSelectDate(dateIso);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={
                    isDisabled
                      ? `${formatDateWithWeekday(dateIso)}, unavailable`
                      : `${formatDateWithWeekday(dateIso)}, ${count} open slots`
                  }
                  className={`flex flex-col items-center justify-center rounded-md border px-1 py-0.5 transition-colors ${
                    variant === 'wizard' ? 'h-9 sm:h-[38px]' : 'min-h-[40px]'
                  } ${
                    isDisabled
                      ? 'cursor-not-allowed border-transparent bg-transparent text-slate-300 dark:text-slate-600'
                      : isSelected
                        ? 'border-brand-primary bg-brand-primary text-brand-fg'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-brand-primary hover:bg-brand-soft-bg dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-brand-primary dark:hover:bg-brand-soft-bg-dark'
                  }`}
                >
                  <span className="text-xs font-semibold tabular-nums leading-none">
                    {cell.dayNumber}
                  </span>
                  {!isDisabled ? (
                    <span
                      className={`mt-0.5 rounded px-1 font-mono text-[9px] font-semibold tabular-nums leading-none ${
                        isSelected
                          ? 'bg-black/15 text-brand-fg'
                          : 'bg-brand-soft-bg text-brand-text dark:bg-brand-soft-bg-dark dark:text-brand-text-dark'
                      }`}
                    >
                      {count}
                    </span>
                  ) : (
                    <span className="mt-0.5 h-[9px]" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {dateError ? (
          <p
            role="alert"
            className="mt-1.5 text-xs font-medium text-rose-700 dark:text-rose-400"
          >
            {dateError}
          </p>
        ) : null}
      </div>

      <div
        aria-busy={loadingSlots}
        data-testid={variant === 'wizard' ? 'time-slots-panel' : undefined}
        className="min-w-0 lg:col-span-5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              {slotsHeading}
            </span>
            <span className="mt-0.5 block font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
              {formatDateWithWeekday(selectedDate)}
            </span>
          </div>
          {loadingSlots ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text dark:text-brand-text-dark"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Loading...</span>
            </span>
          ) : null}
        </div>

        {loadingSlots ? (
          <div className="mt-2.5 space-y-3" aria-hidden="true">
            <div>
              <div className="mb-1.5 h-3 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-9 animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800"
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-9 animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : slots.length === 0 ? (
          <p className="mt-2.5 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            {emptySlotsMessage}
          </p>
        ) : (
          <div
            data-testid={variant === 'wizard' ? 'time-slots-scroll-area' : undefined}
            className="mt-2.5 max-h-[268px] space-y-3 overflow-y-auto pr-1"
          >
            {[
              { label: 'Morning', items: morningSlots },
              { label: 'Afternoon', items: afternoonSlots },
            ].map((group) =>
              group.items.length > 0 ? (
                <div key={group.label}>
                  <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((slot) => {
                      const isSelected = selectedTime24 === slot.time24;
                      return (
                        <button
                          key={slot.time24}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => onSelectTime(slot.time24)}
                          aria-pressed={isSelected}
                          className={`rounded-md border px-2 py-1.5 text-xs font-mono tabular-nums font-medium transition-colors min-h-[36px] whitespace-nowrap ${
                            !slot.available
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-500'
                              : isSelected
                                ? 'border-brand-primary bg-brand-primary text-brand-fg'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-brand-primary hover:text-brand-text dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-brand-primary dark:hover:text-brand-text-dark'
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        {timeError ? (
          <p
            role="alert"
            className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-400"
          >
            {timeError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
