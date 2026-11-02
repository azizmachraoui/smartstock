import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { orderService, productService, stockService } from '../services/api';
import { qk } from '../lib/queryKeys';
import type {
  MovementType,
  OrderStatus,
  Paginated,
  Product,
  ProductParams,
  StockMovement,
  StockMovementParams,
} from '../types';

const PAGE = 100;
const MAX_PAGES = 10;

export interface AllProductsResult {
  data: Product[];
  total: number;
  truncated: boolean;
}

/** Fetches every page needed for aggregate views (valuation, reports). */
export function useAllProducts(scope: string, params?: Omit<ProductParams, 'page' | 'limit'>) {
  return useQuery<AllProductsResult>({
    queryKey: qk.allProducts(scope),
    queryFn: async () => {
      const first = await productService.list({ ...params, page: 1, limit: PAGE });
      const data = [...first.data];
      const pages = Math.min(first.pages, MAX_PAGES);
      for (let page = 2; page <= pages; page += 1) {
        const next = await productService.list({ ...params, page, limit: PAGE });
        data.push(...next.data);
      }
      return { data, total: first.total, truncated: first.pages > MAX_PAGES };
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export interface AllMovementsResult {
  data: StockMovement[];
  total: number;
  truncated: boolean;
}

export function useAllMovements(
  scope: string,
  params?: Omit<StockMovementParams, 'page' | 'limit'>,
  enabled = true,
) {
  return useQuery<AllMovementsResult>({
    queryKey: qk.allMovements(scope),
    queryFn: async () => {
      const first = await stockService.movements({ ...params, page: 1, limit: PAGE });
      const data = [...first.data];
      const pages = Math.min(first.pages, MAX_PAGES);
      for (let page = 2; page <= pages; page += 1) {
        const next = await stockService.movements({ ...params, page, limit: PAGE });
        data.push(...next.data);
      }
      return { data, total: first.total, truncated: first.pages > MAX_PAGES };
    },
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export interface OrderCountsResult {
  PENDING: number;
  CONFIRMED: number;
  RECEIVED: number;
  CANCELLED: number;
  total: number;
}

const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'RECEIVED', 'CANCELLED'];

export function useOrderCounts(
  range: string,
  rangeParams: { from?: string; to?: string } | undefined,
  enabled: boolean,
) {
  return useQuery<OrderCountsResult>({
    queryKey: qk.orderCounts(range),
    queryFn: async () => {
      const results = await Promise.all(
        STATUSES.map((status) =>
          orderService.list({ ...rangeParams, status, page: 1, limit: 1 }),
        ),
      );
      const counts = Object.fromEntries(
        STATUSES.map((status, index) => [status, results[index].total]),
      ) as Record<OrderStatus, number>;
      return {
        ...counts,
        total: STATUSES.reduce((sum, status) => sum + counts[status], 0),
      } satisfies OrderCountsResult;
    },
    enabled,
    staleTime: 45_000,
  });
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · SmartStock`;
    return () => {
      document.title = 'SmartStock — Inventory Control';
    };
  }, [title]);
}

export function totalPagesOf(page: Paginated<unknown> | undefined): number {
  return Math.max(page?.pages ?? 1, 1);
}

export const MOVEMENT_TYPES: MovementType[] = ['IN', 'OUT', 'ADJUSTMENT'];
