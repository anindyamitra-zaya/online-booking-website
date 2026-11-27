interface AppointmentsRowsSkeletonProps {
  count?: number;
}

export function AppointmentsRowsSkeleton({
  count = 3,
}: AppointmentsRowsSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading upcoming appointments"
      data-testid="appointments-rows-skeleton"
      className="divide-y divide-slate-200 dark:divide-slate-800"
    >
      <span className="sr-only">Loading upcoming appointments...</span>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:px-5 sm:py-3.5 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-5 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
              <div className="h-5 w-44 sm:w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="h-4 w-44 sm:w-52 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
              <div className="h-4 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center shrink-0">
            <div className="h-9 w-full sm:w-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-9 w-full sm:w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-9 w-full sm:w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-9 w-full sm:w-18 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AppointmentsViewSkeleton() {
  return (
    <section
      role="status"
      aria-busy="true"
      aria-label="Loading appointments view"
      data-testid="appointments-view-skeleton"
      className="flex flex-1 flex-col min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="sr-only">Loading appointments view...</span>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5 dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-48 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-7 shrink-0 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-3.5 w-60 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="h-[38px] w-full sm:w-56 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-[38px] w-full sm:w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      <AppointmentsRowsSkeleton count={3} />
    </section>
  );
}

export function BookingWizardSkeleton() {
  const stepNodes = [0, 1, 2, 3];

  return (
    <section
      role="status"
      aria-busy="true"
      aria-label="Loading booking wizard"
      data-testid="booking-wizard-skeleton"
      className="flex flex-1 flex-col justify-between w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="sr-only">Loading appointment booking wizard...</span>

      {/* Header + Node Timeline Skeleton */}
      <div className="border-b border-slate-200 px-3.5 py-3 sm:px-6 sm:py-3.5 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-3.5 w-32 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3.5 w-20 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="mt-2 h-6 sm:h-7 w-64 max-w-full sm:w-80 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

        <div className="mt-3 sm:mt-3.5 flex items-start justify-between sm:pb-5">
          {stepNodes.map((node, idx) => {
            const isLast = idx === stepNodes.length - 1;
            return (
              <div
                key={node}
                className={`flex min-w-0 items-start ${isLast ? 'shrink-0' : 'flex-1'}`}
              >
                <div className="relative flex flex-col items-center">
                  <div className="h-6 w-6 sm:h-8 sm:w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="hidden sm:block sm:mt-1.5 h-3 w-14 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                </div>
                {!isLast ? (
                  <div className="flex h-6 sm:h-8 flex-1 items-center px-0.5 sm:px-2">
                    <div className="h-0.5 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Body: Calendar + Time Slots / Option Grid Skeleton */}
      <div className="flex-1 min-w-0 p-3.5 sm:p-5">
        <div className="grid min-w-0 gap-4 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-7 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="h-5 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <div className="h-8 w-8 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
                <div className="h-8 w-8 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-950/40 space-y-2">
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="mx-auto h-3 w-6 animate-pulse rounded bg-slate-200 dark:bg-slate-800"
                  />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 28 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-9 sm:h-[38px] animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800/70"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
            <div className="space-y-1.5 border-b border-slate-200 pb-2 dark:border-slate-800">
              <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3.5 w-44 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-9 animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-1.5">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-9 animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Footer Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-t border-slate-200 px-4 py-3 sm:px-6 dark:border-slate-800">
        <div className="h-10 w-28 sm:w-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="h-10 w-28 sm:w-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    </section>
  );
}

export function PatientVerificationSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading patient verification portal"
      data-testid="patient-verification-skeleton"
      className="grid flex-1 min-w-0 gap-4 sm:gap-6 lg:grid-cols-12 lg:items-stretch"
    >
      <span className="sr-only">Loading patient verification portal...</span>
      <div className="relative flex min-w-0 min-h-[200px] sm:min-h-[260px] flex-col justify-end overflow-hidden rounded-xl border border-slate-200 bg-slate-200/70 p-4 sm:p-7 lg:col-span-5 lg:min-h-[380px] dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-2.5">
          <div className="h-3.5 w-44 animate-pulse rounded bg-slate-300 dark:bg-slate-800" />
          <div className="h-7 w-56 animate-pulse rounded bg-slate-300 dark:bg-slate-800" />
          <div className="flex gap-4 pt-1">
            <div className="h-3.5 w-28 animate-pulse rounded bg-slate-300/80 dark:bg-slate-800" />
            <div className="h-3.5 w-40 animate-pulse rounded bg-slate-300/80 dark:bg-slate-800" />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 sm:p-7 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-5">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800 space-y-2">
            <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-7 w-52 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-16 w-64 max-w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="mt-6 border-t border-slate-100 pt-3.5 dark:border-slate-800">
          <div className="h-3.5 w-48 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export function CareTeamSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading care team"
      data-testid="care-team-skeleton"
      className="space-y-4"
    >
      <span className="sr-only">Loading care team...</span>
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-baseline sm:justify-between dark:border-slate-800">
        <div className="h-7 w-60 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-52 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-5 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-3.5 w-44 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
            <div className="h-10 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClinicInfoSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading clinic information"
      data-testid="clinic-info-skeleton"
      className="space-y-4"
    >
      <span className="sr-only">Loading clinic information...</span>
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="h-3.5 w-40 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-7 w-64 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="h-4 w-28 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-40 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-5 w-44 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-16 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
