import React from 'react';
import { Skeleton } from './States';

type Tone = 'brand' | 'navy' | 'amber' | 'rose' | 'sky' | 'violet';

const tones: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  navy: 'bg-navy-50 text-navy-700 dark:bg-white/5 dark:text-slate-200',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  loading = false,
  action,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface group relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {loading ? (
            <>
              <Skeleton className="mt-3 h-8 w-28" />
              <Skeleton className="mt-3 h-3 w-36" />
            </>
          ) : (
            <>
              <p className="mt-2 truncate text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">
                {value}
              </p>
              {hint ? (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
              ) : null}
            </>
          )}
        </div>
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
