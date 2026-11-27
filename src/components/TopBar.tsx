import {
  BadgeCheck,
  Calendar,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Phone,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PatientProfile } from '../types/clinic';
import { formatDateLabel, getProviderInitials } from '../utils/appointments';

export type PortalSection = 'appointments' | 'book' | 'team' | 'clinic';

interface TopBarProps {
  clinicShortName: string;
  patient: PatientProfile | null;
  patientKind?: 'established' | 'new' | null;
  upcomingCount: number;
  activeSection: PortalSection;
  onNavigate: (section: PortalSection) => void;
  onLogoutPatient: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function TopBar({
  clinicShortName,
  patient,
  patientKind,
  upcomingCount,
  activeSection,
  onNavigate,
  onLogoutPatient,
  theme,
  onToggleTheme,
}: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [patientMenuOpen, setPatientMenuOpen] = useState(false);
  const patientMenuRef = useRef<HTMLDivElement | null>(null);
  const isPatientVerified = Boolean(patient);

  useEffect(() => {
    if (!patient) {
      setPatientMenuOpen(false);
    }
  }, [patient]);

  useEffect(() => {
    if (!patientMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        patientMenuRef.current &&
        !patientMenuRef.current.contains(e.target as Node)
      ) {
        setPatientMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPatientMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [patientMenuOpen]);

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
        { id: 'clinic', label: 'About Us' },
      ]
    : [
        { id: 'appointments', label: 'Book & Manage Appointments' },
        { id: 'team', label: 'Care Team' },
        { id: 'clinic', label: 'About Us' },
      ];

  const handleNavClick = (section: PortalSection) => {
    onNavigate(section);
    setMobileMenuOpen(false);
    setPatientMenuOpen(false);
  };

  const handleLogoutClick = () => {
    setPatientMenuOpen(false);
    setMobileMenuOpen(false);
    onLogoutPatient();
  };

  const cityStatePin = patient
    ? [patient.city, patient.state, patient.pin].filter(Boolean).join(', ')
    : '';
  const addressStr = patient
    ? [patient.street, cityStatePin].filter(Boolean).join(', ')
    : '';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 sm:gap-6 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('appointments')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap min-w-0 max-w-[200px] sm:max-w-none truncate text-left rounded-md px-1 py-1 hover:text-brand-text dark:hover:text-brand-text-dark transition-colors"
        >
          {clinicShortName}
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary portal navigation"
          className="hidden lg:flex items-center gap-5 xl:gap-6"
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
                    ? 'text-brand-text dark:text-brand-text-dark'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {typeof item.badgeCount === 'number' ? (
                  <span
                    data-testid="nav-appointments-count"
                    className={`inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums leading-none ${
                      isActive
                        ? 'bg-brand-primary text-brand-fg'
                        : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                ) : null}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[9px] h-0.5 bg-brand-primary"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle, Patient Menu + Logout, and Primary CTA */}
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

          {patient ? (
            <>
              <div ref={patientMenuRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setPatientMenuOpen((prev) => !prev)}
                  aria-expanded={patientMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`Patient account menu for ${patient.fullName}`}
                  data-testid="nav-patient-menu-trigger"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-primary font-display text-[11px] font-bold text-brand-fg"
                  >
                    {getProviderInitials(patient.fullName)}
                  </span>
                  <span className="max-w-[140px] truncate font-semibold">
                    {patient.fullName}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform ${
                      patientMenuOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {patientMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Patient details and account actions"
                    data-testid="nav-patient-dropdown"
                    className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900 z-40"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                          {patient.fullName}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          <BadgeCheck
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            {patientKind === 'new'
                              ? 'Registered Patient'
                              : 'Verified Patient'}
                          </span>
                          {patient.sex ? (
                            <span className="text-slate-400 dark:text-slate-500">
                              · {patient.sex}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Calendar
                          className="h-3.5 w-3.5 shrink-0 text-slate-400"
                          aria-hidden="true"
                        />
                        <dt className="sr-only">Date of Birth</dt>
                        <dd className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                          {formatDateLabel(patient.dateOfBirth)}
                        </dd>
                      </div>
                      {patient.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                          <dt className="sr-only">Phone</dt>
                          <dd className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                            {patient.phone}
                          </dd>
                        </div>
                      ) : null}
                      {addressStr ? (
                        <div className="flex items-start gap-2">
                          <MapPin
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                          <dt className="sr-only">Address</dt>
                          <dd className="leading-snug text-slate-700 dark:text-slate-300">
                            {addressStr}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                data-testid="nav-switch-patient-button"
                onClick={handleLogoutClick}
                className="hidden sm:inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-soft-border bg-white px-3.5 py-1.5 text-xs lg:text-sm font-semibold text-brand-text hover:bg-brand-soft-bg dark:border-brand-soft-border-dark dark:bg-slate-900 dark:text-brand-text-dark dark:hover:bg-brand-soft-bg-dark transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Switch Patient</span>
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-portal-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open navigation menu'}
            className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Accessible Mobile & Tablet Drawer */}
      {mobileMenuOpen ? (
        <div
          id="mobile-portal-menu"
          className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
        >
          {patient ? (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  {patient.fullName}
                </p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {formatDateLabel(patient.dateOfBirth)}
                  {patient.phone ? ` · ${patient.phone}` : ''}
                </p>
              </div>
            </div>
          ) : null}

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
                      ? 'bg-brand-soft-bg text-brand-text dark:bg-brand-soft-bg-dark dark:text-brand-text-dark'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.badgeCount === 'number' ? (
                    <span
                      className={`inline-flex min-w-[22px] items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                        isActive
                          ? 'bg-brand-primary text-brand-fg'
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
                onClick={handleLogoutClick}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-soft-border bg-white px-4 py-3 text-base font-semibold text-brand-text hover:bg-brand-soft-bg dark:border-brand-soft-border-dark dark:bg-slate-900 dark:text-brand-text-dark dark:hover:bg-brand-soft-bg-dark transition-colors min-h-[44px]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Switch Patient</span>
              </button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
