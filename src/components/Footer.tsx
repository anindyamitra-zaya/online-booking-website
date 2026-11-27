export function Footer() {
  return (
    <footer
      data-testid="site-footer"
      className="mt-auto w-full min-w-0 border-t border-slate-200 bg-white/90 text-slate-600 dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-300"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-3.5 text-center sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs sm:text-sm">
          <span className="text-slate-500 dark:text-slate-400">Powered by</span>
          <a
            href="https://zayahealth.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-display font-bold text-brand-text hover:underline dark:text-brand-text-dark"
          >
            Zaya
          </a>
        </div>
      </div>
    </footer>
  );
}
