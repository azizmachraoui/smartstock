import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Boxes } from 'lucide-react';

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 dark:bg-navy-950">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[110px]"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to sign in
        </Link>

        <div className="surface p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-navy-900 text-brand-400 dark:bg-brand-500/15">
              <Boxes className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">SmartStock</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Inventory control</p>
            </div>
          </div>

          <h1 className="mt-6 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>

          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-xs text-slate-400">{footer}</div> : null}
      </div>
    </div>
  );
}
