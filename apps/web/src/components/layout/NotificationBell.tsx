import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Bell, CheckCheck, PackageX, ShoppingCart } from 'lucide-react';
import { notificationService } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatRelative } from '../../utils/format';
import { getErrorMessage } from '../../lib/errors';
import type { Notification } from '../../types';

function NotificationIcon({ type }: { type: Notification['type'] }) {
  if (type === 'OUT_OF_STOCK') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
        <PackageX className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  if (type === 'LOW_STOCK') {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  if (type.startsWith('ORDER')) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <Bell className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  const unread = useQuery({
    queryKey: qk.unreadCount,
    queryFn: notificationService.unreadCount,
    refetchInterval: 60_000,
  });

  const latest = useQuery({
    queryKey: qk.notifications({ limit: 6 }),
    queryFn: () => notificationService.list({ limit: 6 }),
    enabled: open,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markAll = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      void invalidate();
      toast.success('All notifications marked as read');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => void invalidate(),
  });

  const openNotification = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    setOpen(false);
    const product = notification.relatedProduct;
    if (product && typeof product === 'object') navigate(`/products/${product.id}`);
    else navigate('/notifications');
  };

  const count = unread.data?.count ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <Bell className="h-[19px] w-[19px]" aria-hidden="true" />
        {count > 0 ? (
          <span className="absolute right-1.5 top-1.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[17px] text-white ring-2 ring-white dark:ring-navy-950">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift animate-slide-up dark:border-slate-800 dark:bg-navy-900">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {count > 0 ? `${count} unread` : 'You are all caught up'}
              </p>
            </div>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-500 disabled:opacity-50 dark:text-brand-400"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="scrollbar-thin max-h-[22rem] overflow-y-auto">
            {latest.isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="flex gap-3">
                    <span className="skeleton h-8 w-8 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <span className="skeleton block h-3 w-32" />
                      <span className="skeleton block h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : latest.isError ? (
              <div className="p-4 text-xs text-rose-600 dark:text-rose-400">
                {getErrorMessage(latest.error)}
              </div>
            ) : (latest.data?.data.length ?? 0) === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nothing here yet
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Stock alerts and order updates will appear here.
                </p>
              </div>
            ) : (
              <ul>
                {latest.data?.data.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                        notification.isRead ? '' : 'bg-brand-50/40 dark:bg-brand-500/5'
                      }`}
                    >
                      <NotificationIcon type={notification.type} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            {notification.title ?? 'Notification'}
                          </span>
                          {!notification.isRead ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          ) : null}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {formatRelative(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
            className="block w-full border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            View all notifications
          </button>
        </div>
      ) : null}
    </div>
  );
}
