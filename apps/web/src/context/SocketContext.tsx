import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BellRing, WifiOff } from 'lucide-react';
import type { DomainEvent, ServerToClientEvents } from '../types';
import { useAuth } from './AuthContext';
import {
  getAccessToken,
  refreshSession,
  API_ORIGIN,
} from '../services/api';
import { DERIVED_KEYS } from '../lib/queryKeys';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'unauthorized';

interface SocketContextValue {
  status: ConnectionStatus;
  lastEventAt: string | null;
  conflicts: Record<string, DomainEvent>;
  clearConflict: (key: string) => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_ORIGIN || window.location.origin;

const stringValue = (data: Record<string, unknown> | undefined, key: string): string | undefined => {
  const value = data?.[key];
  return typeof value === 'string' ? value : undefined;
};

function NotificationToast({
  title,
  message,
  onOpen,
}: {
  title: string;
  message: string;
  onOpen: () => void;
}) {
  return (
    <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-700/60 bg-navy-900 p-4 text-slate-100 shadow-lift">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
        <BellRing className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {message ? <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{message}</p> : null}
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 text-xs font-semibold text-brand-300 underline-offset-2 hover:underline"
        >
          View notification
        </button>
      </div>
    </div>
  );
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, DomainEvent>>({});
  const seenEvents = useRef<Set<string>>(new Set());
  const connectedOnce = useRef(false);

  const clearConflict = useCallback((key: string) => {
    setConflicts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const userId = user?.id;
  const role = user?.role;

  useEffect(() => {
    if (!userId || !getAccessToken()) {
      setStatus('disconnected');
      return;
    }

    const socket: Socket<ServerToClientEvents> = io(SOCKET_URL, {
      path: '/socket.io',
      auth: { token: getAccessToken() },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.4,
      timeout: 12_000,
    });

    let refreshAttempted = false;

    const invalidate = (keys: readonly (readonly unknown[])[]) => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
    };

    const invalidateDerived = () => invalidate(DERIVED_KEYS);

    const accept = (event: DomainEvent): boolean => {
      if (event.eventId) {
        if (seenEvents.current.has(event.eventId)) return false;
        seenEvents.current.add(event.eventId);
        if (seenEvents.current.size > 500) {
          const first = seenEvents.current.values().next().value;
          if (first) seenEvents.current.delete(first);
        }
      }
      setLastEventAt(event.at ?? new Date().toISOString());
      if (event.actorId && event.actorId !== userId && event.id) {
        const key = `${event.entity}:${event.id}`;
        setConflicts((current) => ({ ...current, [key]: event }));
      }
      return true;
    };

    const onReady = () => {
      setStatus('connected');
      if (connectedOnce.current) {
        void queryClient.invalidateQueries();
      }
      connectedOnce.current = true;
    };

    const onConnectError = (error: Error) => {
      if (error.message.includes('AUTH')) {
        setStatus('unauthorized');
        if (!refreshAttempted) {
          refreshAttempted = true;
          void refreshSession()
            .then(() => {
              socket.auth = { token: getAccessToken() };
              setStatus('connecting');
              socket.connect();
            })
            .catch(() => setStatus('unauthorized'));
        }
        return;
      }
      setStatus('disconnected');
    };

    const onDisconnect = (reason: string) => {
      if (reason !== 'io client disconnect') setStatus('connecting');
    };

    const onProductChanged = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([
        ['products'],
        ['product'],
        ['categories'],
        ['suppliers'],
        ['stock-alerts'],
        ['all-products'],
      ]);
      invalidateDerived();
    };

    const onCategoryChanged = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([['categories'], ['category'], ['products'], ['product'], ['all-products']]);
      invalidateDerived();
    };

    const onSupplierChanged = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([
        ['suppliers'],
        ['supplier'],
        ['supplier-orders'],
        ['products'],
        ['product'],
        ['all-products'],
      ]);
      invalidateDerived();
    };

    const onStockUpdated = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([
        ['products'],
        ['product'],
        ['movements'],
        ['all-movements'],
        ['stock-alerts'],
        ['all-products'],
      ]);
      invalidateDerived();
    };

    const onMovementCreated = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([
        ['movements'],
        ['all-movements'],
        ['products'],
        ['product'],
        ['stock-alerts'],
      ]);
      invalidateDerived();
    };

    const onOrderEvent = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([
        ['orders'],
        ['order'],
        ['order-counts'],
        ['suppliers'],
        ['supplier'],
        ['supplier-orders'],
      ]);
      invalidateDerived();
    };

    const onNotificationNew = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([['notifications']]);
      const title = stringValue(event.data, 'title') ?? 'New notification';
      const message = stringValue(event.data, 'message') ?? '';
      const toastsEnabled = localStorage.getItem('smartstock:pref:toasts') !== 'false';
      if (toastsEnabled) {
        toast.custom(
          (t) => (
            <NotificationToast
              title={title}
              message={message}
              onOpen={() => {
                toast.dismiss(t.id);
                navigate('/notifications');
              }}
            />
          ),
          { id: event.eventId, duration: 7_000, position: 'top-right' },
        );
      }
      const desktopEnabled = localStorage.getItem('smartstock:pref:desktop') === 'true';
      if (desktopEnabled && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body: message, icon: '/favicon.svg' });
        } catch {
          // Desktop notifications are best-effort only.
        }
      }
    };

    const onNotificationChanged = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([['notifications']]);
    };

    const onUserChanged = (event: DomainEvent) => {
      if (!accept(event)) return;
      invalidate([['users']]);
      if (event.id === userId) invalidate([['me']]);
    };

    const onTokenRefreshed = () => {
      refreshAttempted = false;
      socket.auth = { token: getAccessToken() };
      if (!socket.connected) {
        setStatus('connecting');
        socket.connect();
      }
    };

    const onOnline = () => {
      void queryClient.invalidateQueries();
      if (!socket.connected) socket.connect();
    };

    socket.on('connect', onReady);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.on('socket:ready', onReady);
    socket.on('product:changed', onProductChanged);
    socket.on('category:changed', onCategoryChanged);
    socket.on('supplier:changed', onSupplierChanged);
    socket.on('stock:updated', onStockUpdated);
    socket.on('stock-movement:created', onMovementCreated);
    socket.on('order:created', onOrderEvent);
    socket.on('order:updated', onOrderEvent);
    socket.on('order:status-changed', onOrderEvent);
    socket.on('notification:new', onNotificationNew);
    socket.on('notification:changed', onNotificationChanged);
    socket.on('user:changed', onUserChanged);
    socket.on('product:low-stock', onStockUpdated);
    socket.on('product:out-of-stock', onStockUpdated);
    window.addEventListener('auth:token-refreshed', onTokenRefreshed);
    window.addEventListener('online', onOnline);

    setStatus('connecting');

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      window.removeEventListener('auth:token-refreshed', onTokenRefreshed);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, role, navigate, queryClient]);

  const value = useMemo<SocketContextValue>(
    () => ({ status, lastEventAt, conflicts, clearConflict }),
    [status, lastEventAt, conflicts, clearConflict],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used inside SocketProvider');
  return context;
}

/** True when another user changed this record while the form has been open. */
export function useRecordConflict(entity: string, id?: string) {
  const { conflicts, clearConflict } = useSocket();
  const key = id ? `${entity}:${id}` : '';
  const conflict = key ? conflicts[key] : undefined;
  return {
    conflict,
    hasConflict: Boolean(conflict),
    clearConflict: useCallback(() => {
      if (key) clearConflict(key);
    }, [key, clearConflict]),
  };
}

export function ConnectionBadge() {
  const { status } = useSocket();
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
        Live
      </span>
    );
  }
  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        Connecting
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      Offline
    </span>
  );
}
