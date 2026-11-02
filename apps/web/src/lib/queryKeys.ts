import type {
  CategoryParams,
  NotificationParams,
  OrderParams,
  ProductParams,
  StockMovementParams,
  SupplierParams,
} from '../types';

/**
 * Every key starts with a stable domain prefix so socket handlers can
 * invalidate a whole family with a single prefix match.
 */
export const qk = {
  me: ['me'] as const,
  users: ['users'] as const,

  products: (params?: ProductParams) => ['products', params ?? {}] as const,
  product: (id: string) => ['product', id] as const,
  allProducts: (scope: string) => ['all-products', scope] as const,

  categories: (params?: CategoryParams) => ['categories', params ?? {}] as const,
  category: (id: string) => ['category', id] as const,

  suppliers: (params?: SupplierParams) => ['suppliers', params ?? {}] as const,
  supplier: (id: string) => ['supplier', id] as const,
  supplierOrders: (id: string, params?: OrderParams) =>
    ['supplier-orders', id, params ?? {}] as const,

  movements: (params?: StockMovementParams) => ['movements', params ?? {}] as const,
  allMovements: (scope: string) => ['all-movements', scope] as const,
  alerts: ['stock-alerts'] as const,

  orders: (params?: OrderParams) => ['orders', params ?? {}] as const,
  order: (id: string) => ['order', id] as const,
  orderCounts: (range: string) => ['order-counts', range] as const,

  notifications: (params?: NotificationParams) => ['notifications', params ?? {}] as const,
  unreadCount: ['notifications', 'unread-count'] as const,

  dashboard: ['dashboard'] as const,
  reports: (scope: string) => ['reports', scope] as const,
};

/** Query-key prefixes invalidated when any inventory data changes. */
export const DERIVED_KEYS: readonly (readonly unknown[])[] = [
  ['dashboard'],
  ['reports'],
  ['order-counts'],
  ['all-products'],
  ['all-movements'],
  ['stock-alerts'],
];
