import { useLocation } from 'react-router-dom';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ConnectionBadge } from '../../context/SocketContext';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

const titles: { prefix: string; title: string }[] = [
  { prefix: '/dashboard', title: 'Dashboard' },
  { prefix: '/products', title: 'Products' },
  { prefix: '/categories', title: 'Categories' },
  { prefix: '/suppliers', title: 'Suppliers' },
  { prefix: '/stock', title: 'Stock movements' },
  { prefix: '/orders', title: 'Purchase orders' },
  { prefix: '/notifications', title: 'Notifications' },
  { prefix: '/users', title: 'Users & roles' },
  { prefix: '/reports', title: 'Reports' },
  { prefix: '/settings', title: 'Settings' },
];

function currentTitle(pathname: string): string {
  return titles.find((item) => pathname.startsWith(item.prefix))?.title ?? 'SmartStock';
}

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { pathname } = useLocation();
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-navy-950/80">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {currentTitle(pathname)}
          </p>
          <p className="hidden text-[11px] text-slate-400 sm:block dark:text-slate-500">
            SmartStock workspace
          </p>
        </div>

        <div className="hidden items-center rounded-full border border-slate-200 px-3 py-1.5 md:flex dark:border-slate-800">
          <ConnectionBadge />
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-[19px] w-[19px]" aria-hidden="true" />
          ) : (
            <Moon className="h-[19px] w-[19px]" aria-hidden="true" />
          )}
        </button>

        <NotificationBell />

        <span className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-800" aria-hidden="true" />

        <UserMenu />
      </div>
    </header>
  );
}
