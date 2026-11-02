import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../ui/Badge';
import { initials } from '../../utils/format';
import { useClickOutside } from '../../hooks/useClickOutside';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  if (!user) return null;

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700"
          />
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-xs font-bold text-white dark:bg-brand-500/15 dark:text-brand-300">
            {initials(user.firstName, user.lastName)}
          </span>
        )}
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[9rem] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
            {user.firstName} {user.lastName}
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {user.role.toLowerCase()}
          </span>
        </span>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-slate-400 transition sm:block ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift animate-slide-up dark:border-slate-800 dark:bg-navy-900"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <UserRound className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
              <div className="mt-1">
                <RoleBadge role={user.role} />
              </div>
            </div>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/settings');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Account settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
