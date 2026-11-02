import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useData';
import { Button } from '../components/ui/Button';

export default function NotFound() {
  useDocumentTitle('Page not found');

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="surface w-full max-w-lg p-8 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          404 · Not found
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          This page does not exist
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          The link may be outdated, or the record may have been moved. Head back to the dashboard to
          pick up where you left off.
        </p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
