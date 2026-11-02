import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useData';
import { Button } from '../components/ui/Button';
import { RoleBadge } from '../components/ui/Badge';

export default function Forbidden() {
  useDocumentTitle('Access denied');
  const { user } = useAuth();

  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="surface w-full max-w-lg p-8 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          <ShieldOff className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
          403 · Access denied
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          This area is outside your role
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Your account does not have permission to open this page. Ask an administrator if you
          believe you should have access.
        </p>
        {user ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Signed in as {user.email}
            <RoleBadge role={user.role} />
          </div>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link to="/dashboard">
            <Button leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />} className="w-full sm:w-auto">
              Back to dashboard
            </Button>
          </Link>
          <Link to="/settings">
            <Button variant="secondary" className="w-full sm:w-auto">
              Account settings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
