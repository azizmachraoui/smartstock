import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const SIDEBAR_KEY = 'smartstock:sidebar-collapsed';

export function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_KEY) === '1',
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 dark:bg-navy-950">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only"
      >
        Skip to content
      </a>

      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
            role="presentation"
          />
          <div className="absolute inset-y-0 left-0 shadow-lift animate-slide-up">
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div
        className={`flex min-h-dvh flex-col transition-[padding] duration-200 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-[264px]'
        }`}
      >
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1540px] animate-fade-in">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-slate-200/70 px-4 py-4 text-xs text-slate-400 sm:px-6 lg:px-8 dark:border-slate-800/70 dark:text-slate-500">
          <div className="mx-auto flex max-w-[1540px] flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p>SmartStock · Inventory, purchasing and stock control</p>
            <p>Live data from the SmartStock API</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
