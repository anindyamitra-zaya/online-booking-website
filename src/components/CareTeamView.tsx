import { Languages, MapPin } from 'lucide-react';
import type { ClinicProfile, Provider } from '../types/clinic';
import {
  formatDateWithWeekday,
  getProviderInitials,
} from '../utils/appointments';

interface CareTeamViewProps {
  clinic: ClinicProfile;
  providers: Provider[];
}

export function CareTeamView({ clinic, providers }: CareTeamViewProps) {
  return (
    <div className="flex flex-1 flex-col min-w-0 space-y-4">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-baseline sm:justify-between dark:border-slate-800">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Specialists &amp; Care Team
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Board-certified clinicians at {clinic.name}.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {providers.map((provider) => {
          const locationNames = provider.locationIds
            .map(
              (id) => clinic.locations.find((loc) => loc.id === id)?.name || id
            )
            .join(' · ');

          return (
            <article
              key={provider.id}
              className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="min-w-0 space-y-2.5">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 font-display text-sm font-bold text-brand-text dark:border-slate-700 dark:bg-slate-800 dark:text-brand-text-dark"
                  >
                    {getProviderInitials(provider.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                      {provider.name}, {provider.credentials}
                    </h2>
                    <p className="break-words text-xs font-medium text-brand-text dark:text-brand-text-dark">
                      {provider.specialty}
                    </p>
                    <p className="mt-0.5 break-words text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      Next open date: {formatDateWithWeekday(provider.nextAvailableDate)}
                    </p>
                  </div>
                </div>

                <p className="break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {provider.bio}
                </p>

                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="break-words">{locationNames}</span>
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Languages className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="break-words">Languages: {provider.languages.join(', ')}</span>
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
