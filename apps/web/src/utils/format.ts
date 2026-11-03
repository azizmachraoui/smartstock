import type { OrderStatus, Role, StockStatus } from '../types';

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Number.isFinite(value) ? value : 0);
}

export function formatDate(
  date: string | Date | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', ...options }).format(value);
}

export function formatDay(date: string | Date): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(value);
}

export function formatDateTime(date: string | Date | undefined): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

export function formatRelative(date: string | Date | undefined): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  const diffSeconds = Math.round((value.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];
  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatDate(value);
}

export function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function getStockStatus(quantity: number, minimumStock: number): StockStatus {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity <= minimumStock) return 'LOW_STOCK';
  return 'OK';
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

export const stockStatusLabel = (status: StockStatus): string =>
  status === 'OK' ? 'In stock' : status === 'LOW_STOCK' ? 'Low stock' : 'Out of stock';

export const orderStatusLabel = (status: OrderStatus): string => titleCase(status);

export const roleLabel = (role: Role): string => titleCase(role);

export const roleDescription: Record<Role, string> = {
  ADMIN: 'Full access, including users, settings and every inventory workflow.',
  MANAGER: 'Can manage catalog, suppliers, stock adjustments, purchase orders and reports.',
  EMPLOYEE: 'Can view the catalog and record stock in/out. Cannot manage prices or orders.',
};

/** yyyy-mm-dd suitable for <input type="date">. */
export function toDateInput(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function startOfDayIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function endOfDayIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
