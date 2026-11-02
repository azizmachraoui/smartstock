import React from 'react';
import type { MovementType, OrderStatus, Role, StockStatus } from '../../types';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'accent'
  | 'purple'
  | 'gray'
  | 'primary'
  | 'subtle';

const variants: Record<BadgeVariant, string> = {
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  warning:
    'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  danger:
    'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
  info:
    'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
  neutral:
    'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/30',
  accent:
    'bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20',
  purple:
    'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
  gray:
    'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/30',
  primary:
    'bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20',
  subtle:
    'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/30',
};

const dots: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  neutral: 'bg-slate-400',
  accent: 'bg-brand-500',
  purple: 'bg-violet-500',
  gray: 'bg-slate-400',
  primary: 'bg-brand-500',
  subtle: 'bg-slate-400',
};

export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${variants[variant]} ${className}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dots[variant]}`} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const stockConfig: Record<StockStatus, { label: string; variant: BadgeVariant }> = {
  OK: { label: 'In stock', variant: 'success' },
  LOW_STOCK: { label: 'Low stock', variant: 'warning' },
  OUT_OF_STOCK: { label: 'Out of stock', variant: 'danger' },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const config = stockConfig[status] ?? stockConfig.OK;
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

const orderConfig: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'info' },
  RECEIVED: { label: 'Received', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = orderConfig[status] ?? orderConfig.PENDING;
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}

const movementConfig: Record<MovementType, { label: string; variant: BadgeVariant }> = {
  IN: { label: 'Stock in', variant: 'success' },
  OUT: { label: 'Stock out', variant: 'danger' },
  ADJUSTMENT: { label: 'Adjustment', variant: 'info' },
};

export function MovementBadge({ type }: { type: MovementType }) {
  const config = movementConfig[type] ?? movementConfig.IN;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const roleConfig: Record<Role, { label: string; variant: BadgeVariant }> = {
  ADMIN: { label: 'Admin', variant: 'purple' },
  MANAGER: { label: 'Manager', variant: 'info' },
  EMPLOYEE: { label: 'Employee', variant: 'neutral' },
};

export function RoleBadge({ role }: { role: Role }) {
  const config = roleConfig[role] ?? roleConfig.EMPLOYEE;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
