import { Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';

export type PortalSection = 'appointments' | 'book' | 'team' | 'clinic';

interface TopBarProps {
  clinicShortName: string;
  isPatientVerified: boolean;
  upcomingCount: number;
  activeSection: PortalSection;
  onNavigate: (section: PortalSection) => void;
  onStartBooking: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function TopBar({
  clinicShortName,
  isPatientVerified,
  upcomingCount,
  activeSection,
  onNavigate,
  onStartBooking,
  theme,
  onToggleTheme,
}: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{
    id: PortalSection;
    label: string;
    badgeCount?: number;
  }> = isPatientVerified
    ? [
        {
          id: 'appointments',
          label: 'Appointments',
          badgeCount: upcomingCount,
        },
        { id: 'book', label: 'Book Visit' },
        { id: 'team', label: 'Care Team' },
        { id: 'clinic', label: 'Clinic Info' },
      ]
    : [
        { id: 'appointments', label: 'Book & Manage Appointments' },
        { id: 'team', label: 'Care Team' },
        { id: 'clinic', label: 'Clinic Info' },
      ];

  const handleNavClick = (section: PortalSection) => {
    onNavigate(section);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('appointments')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 text-left rounded-md px-1 py-1 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
        >
          {clinicShortName}
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary portal navigation"
          className="hidden md:flex items-center gap-6"
        >
          {navItems.map((item) => {
            const isActive =
              activeSection === item.id ||
              (!isPatientVerified &&
                item.id === 'appointments' &&
                activeSection === 'book');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  typeof item.badgeCount === 'number'
                    ? `${item.label}, ${item.badgeCount} upcoming`
                    : item.label
                }
                className={`relative inline-flex items-center gap-2 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {typeof item.badgeCount === 'number' ? (
                  <span
                    data-testid="nav-appointments-count"
                    className={`inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums leading-none ${
                      isActive
                        ? 'bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950'
                        : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                ) : null}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[9px] h-0.5 bg-teal-700 dark:bg-teal-400"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle + Verified Primary CTA */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Switch to light theme'
                : 'Switch to dark theme'
            }
            aria-pressed={theme === 'dark'}
            title={
              theme === 'dark'
                ? 'Switch to light theme'
                : 'Switch to dark theme'
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {isPatientVerified ? (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onStartBooking();
              }}
              className="hidden sm:inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
            >
              Book Appointment
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-portal-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open navigation menu'}
            className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Accessible Mobile Drawer */}
      {mobileMenuOpen ? (
        <div
          id="mobile-portal-menu"
          className="md:hidden border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
        >
          <nav aria-label="Mobile portal navigation" className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                activeSection === item.id ||
                (!isPatientVerified &&
                  item.id === 'appointments' &&
                  activeSection === 'book');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-base font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.badgeCount === 'number' ? (
                    <span
                      className={`inline-flex min-w-[22px] items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                        isActive
                          ? 'bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {item.badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {isPatientVerified ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onStartBooking();
                }}
                className="mt-2 flex w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-3 text-base font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 transition-colors min-h-[44px]"
              >
                Book Appointment
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
