import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Boxes,
  CircleDollarSign,
  Package,
  Plus,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import type { DataColumn } from '../components/ui/DataTable';
import type { Product, StockMovement } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { qk } from '../lib/queryKeys';
import { stockService, supplierService } from '../services/api';
import {
  useAllMovements,
  useAllProducts,
  useDocumentTitle,
  useOrderCounts,
} from '../hooks/useData';
import {
  daysAgo,
  formatCurrency,
  formatDay,
  formatNumber,
  formatRelative,
  startOfDayIso,
  toDateInput,
} from '../utils/format';
import { getErrorMessage } from '../lib/errors';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { StockStatusBadge, MovementBadge, OrderStatusBadge } from '../components/ui/Badge';
import { ProductImage } from '../components/common/ProductImage';
import { StockMovementModal } from '../components/stock/StockMovementModal';

const productName = (movement: StockMovement): Product['name'] =>
  typeof movement.product === 'string' ? movement.product : movement.product.name;

const productSku = (movement: StockMovement): string =>
  typeof movement.product === 'string' ? '—' : (movement.product.sku ?? '—');

const movementUser = (movement: StockMovement): string =>
  typeof movement.user === 'string' ? '—' : `${movement.user.firstName} ${movement.user.lastName}`;

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user, hasPermission } = useAuth();
  const { resolvedTheme } = useTheme();
  const [movementOpen, setMovementOpen] = useState(false);

  const canWriteProducts = hasPermission('product:write');
  const canWriteStock = hasPermission('stock:write');
  const canReadOrders = hasPermission('order:read');
  const canReadSuppliers = hasPermission('supplier:read');

  const products = useAllProducts('dashboard', { isActive: true });
  const alerts = useQuery({ queryKey: qk.alerts, queryFn: stockService.alerts });
  const suppliers = useQuery({
    queryKey: qk.suppliers({ isActive: true, limit: 1 }),
    queryFn: () => supplierService.list({ isActive: true, limit: 1 }),
    enabled: canReadSuppliers,
  });
  const movements = useAllMovements('dashboard-14d', {
    from: startOfDayIso(toDateInput(daysAgo(13))),
  });
  const recent = useQuery({
    queryKey: qk.movements({ limit: 7 }),
    queryFn: () => stockService.movements({ limit: 7 }),
  });
  const orderCounts = useOrderCounts('all-time', undefined, canReadOrders);

  const productRows = products.data?.data ?? [];

  const metrics = useMemo(() => {
    const units = productRows.reduce((sum, product) => sum + product.quantity, 0);
    const value = productRows.reduce(
      (sum, product) => sum + product.quantity * product.purchasePrice,
      0,
    );
    const retail = productRows.reduce(
      (sum, product) => sum + product.quantity * product.sellingPrice,
      0,
    );
    return { units, value, retail };
  }, [productRows]);

  const trend = useMemo(() => {
    const buckets = new Map<string, { key: string; label: string; in: number; out: number }>();
    for (let index = 13; index >= 0; index -= 1) {
      const date = daysAgo(index);
      const key = toDateInput(date);
      buckets.set(key, { key, label: formatDay(date), in: 0, out: 0 });
    }
    for (const movement of movements.data?.data ?? []) {
      const key = toDateInput(new Date(movement.createdAt));
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (movement.type === 'IN') bucket.in += movement.quantity;
      if (movement.type === 'OUT') bucket.out += movement.quantity;
    }
    return [...buckets.values()];
  }, [movements.data]);

  const trendTotals = useMemo(
    () => trend.reduce((sum, day) => ({ in: sum.in + day.in, out: sum.out + day.out }), { in: 0, out: 0 }),
    [trend],
  );

  const categoryMix = useMemo(() => {
    const map = new Map<string, { name: string; value: number; units: number }>();
    for (const product of productRows) {
      const name = typeof product.category === 'object' ? product.category.name : 'Uncategorised';
      const current = map.get(name) ?? { name, value: 0, units: 0 };
      current.value += product.quantity * product.purchasePrice;
      current.units += product.quantity;
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 5);
  }, [productRows]);

  const maxCategoryValue = categoryMix[0]?.value ?? 1;

  const recentColumns: DataColumn<StockMovement>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (movement) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
            {productName(movement)}
          </p>
          <p className="text-[10px] text-slate-400">{productSku(movement)}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (movement) => <MovementBadge type={movement.type} />,
    },
    {
      key: 'change',
      header: 'Change',
      cell: (movement) => (
        <div>
          <p
            className={`text-xs font-semibold ${
              movement.type === 'OUT'
                ? 'text-rose-600 dark:text-rose-400'
                : movement.type === 'IN'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-sky-600 dark:text-sky-400'
            }`}
          >
            {movement.type === 'OUT' ? '−' : movement.type === 'IN' ? '+' : '='}
            {formatNumber(movement.quantity)}
          </p>
          <p className="text-[10px] text-slate-400">
            {formatNumber(movement.previousQuantity)} → {formatNumber(movement.newQuantity)}
          </p>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'By',
      cell: (movement) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">{movementUser(movement)}</span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      cell: (movement) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatRelative(movement.createdAt)}
        </span>
      ),
    },
  ];

  const firstName = user?.firstName ?? 'there';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const alertsSummary = alerts.data?.summary;
  const openOrders = (orderCounts.data?.PENDING ?? 0) + (orderCounts.data?.CONFIRMED ?? 0);
  const axisColor = resolvedTheme === 'dark' ? '#64748b' : '#94a3b8';
  const gridColor = resolvedTheme === 'dark' ? '#1e293b' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: resolvedTheme === 'dark' ? '#111d33' : '#ffffff',
    border: `1px solid ${resolvedTheme === 'dark' ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: '12px',
    fontSize: '12px',
    color: resolvedTheme === 'dark' ? '#f8fafc' : '#0f172a',
    boxShadow: '0 12px 32px -12px rgb(15 23 42 / 0.35)',
  };

  if (products.isError) {
    return (
      <Card>
        <ErrorState
          title="Dashboard data is unavailable"
          message={getErrorMessage(products.error)}
          onRetry={() => void products.refetch()}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={`${greeting}, ${firstName}`}
        description="A live read on inventory value, stock health and the work moving through purchasing."
        actions={
          <>
            {canWriteProducts ? (
              <Link to="/products/new">
                <Button
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                >
                  Add product
                </Button>
              </Link>
            ) : null}
            {canWriteStock ? (
              <Button
                onClick={() => setMovementOpen(true)}
                leftIcon={<ArrowDownToLine className="h-4 w-4" aria-hidden="true" />}
              >
                Record movement
              </Button>
            ) : null}
          </>
        }
      />

      {!products.isLoading && productRows.length === 0 ? (
        <Card className="border-brand-200 bg-gradient-to-r from-brand-50 to-white p-5 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-navy-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-300">
                <Boxes className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Your inventory is ready for its first product
                </p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Add a product and record initial stock to unlock valuation, alerts and reports.
                </p>
              </div>
            </div>
            {canWriteProducts ? (
              <Link to="/products/new" className="shrink-0">
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>
                  Add first product
                </Button>
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active products"
          value={formatNumber(products.data?.total ?? 0)}
          hint={`${formatNumber(metrics.units)} units on hand`}
          icon={<Package className="h-5 w-5" aria-hidden="true" />}
          tone="navy"
          loading={products.isLoading}
        />
        <StatCard
          label="Inventory value"
          value={formatCurrency(metrics.value)}
          hint={`${formatCurrency(metrics.retail)} at retail`}
          icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
          tone="brand"
          loading={products.isLoading}
        />
        <StatCard
          label="Stock alerts"
          value={formatNumber(alertsSummary?.total ?? 0)}
          hint={
            alerts.isLoading
              ? 'Checking thresholds…'
              : `${alertsSummary?.lowStock ?? 0} low · ${alertsSummary?.outOfStock ?? 0} out of stock`
          }
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          tone={alertsSummary && alertsSummary.total > 0 ? 'rose' : 'amber'}
          loading={alerts.isLoading}
        />
        <StatCard
          label={canReadOrders ? 'Open orders' : 'Active suppliers'}
          value={
            canReadOrders
              ? formatNumber(openOrders)
              : formatNumber(suppliers.data?.total ?? 0)
          }
          hint={
            canReadOrders
              ? `${orderCounts.data?.PENDING ?? 0} pending · ${orderCounts.data?.CONFIRMED ?? 0} confirmed`
              : 'Suppliers available for purchasing'
          }
          icon={
            canReadOrders ? (
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Truck className="h-5 w-5" aria-hidden="true" />
            )
          }
          tone="violet"
          loading={canReadOrders ? orderCounts.isLoading : suppliers.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Stock movement activity"
            description="Units received and removed over the last 14 days."
            action={
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  In {formatNumber(trendTotals.in)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                  Out {formatNumber(trendTotals.out)}
                </span>
              </div>
            }
          />
          <div className="px-2 pb-4 pt-5">
            {movements.isLoading ? (
              <div className="space-y-3 px-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-56 w-full" />
              </div>
            ) : movements.isError ? (
              <ErrorState
                title="Could not load movement history"
                message={getErrorMessage(movements.error)}
                onRetry={() => void movements.refetch()}
              />
            ) : trendTotals.in === 0 && trendTotals.out === 0 ? (
              <EmptyState
                icon={<ArrowDownToLine className="h-6 w-6" aria-hidden="true" />}
                title="No movements in this period"
                description="Record stock in or out and the trend will appear here."
                className="py-10"
              />
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dash-in" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dash-out" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: axisColor }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: axisColor }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={48}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="in"
                      name="Stock in"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#dash-in)"
                    />
                    <Area
                      type="monotone"
                      dataKey="out"
                      name="Stock out"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fill="url(#dash-out)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Needs attention"
            description="Active products at or below their minimum."
            action={
              <Link
                to="/stock?alerts=1"
                className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                View all
              </Link>
            }
          />
          <div className="p-3">
            {alerts.isLoading ? (
              <div className="space-y-3 p-2">
                {[0, 1, 2, 3].map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : alerts.isError ? (
              <ErrorState message={getErrorMessage(alerts.error)} onRetry={() => void alerts.refetch()} />
            ) : (alerts.data?.data.length ?? 0) === 0 ? (
              <EmptyState
                title="All thresholds healthy"
                description="No product is at or below its minimum stock level."
                className="py-8"
              />
            ) : (
              <ul className="space-y-1">
                {alerts.data?.data.slice(0, 5).map((product) => (
                  <li key={product.id}>
                    <Link
                      to={`/products/${product.id}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <ProductImage src={product.image} alt="" className="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">
                          {product.name}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {formatNumber(product.quantity)} / min {formatNumber(product.minimumStock)}{' '}
                          {product.unit}
                        </span>
                      </span>
                      <StockStatusBadge status={product.stockStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent stock activity"
            description="The latest movements across every product."
            action={
              <Link
                to="/stock"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                All movements
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            }
          />
          <DataTable
            caption="Recent stock movements"
            columns={recentColumns}
            rows={recent.data?.data}
            rowKey={(movement) => movement.id}
            loading={recent.isLoading}
            error={recent.error}
            onRetry={() => void recent.refetch()}
            skeletonRows={5}
            empty={
              <EmptyState
                icon={<ArrowDownToLine className="h-6 w-6" aria-hidden="true" />}
                title="No stock movements yet"
                description="Movements will appear here as soon as stock is received, removed or adjusted."
                className="py-10"
              />
            }
          />
        </Card>

        <div className="space-y-4">
          {canReadOrders ? (
            <Card>
              <CardHeader
                title="Purchase pipeline"
                description="Orders by lifecycle stage."
                action={
                  <Link
                    to="/orders"
                    className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Open
                  </Link>
                }
              />
              <div className="space-y-3 p-5">
                {orderCounts.isLoading ? (
                  <>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : orderCounts.isError ? (
                  <ErrorState
                    message={getErrorMessage(orderCounts.error)}
                    onRetry={() => void orderCounts.refetch()}
                  />
                ) : (
                  <>
                    {(['PENDING', 'CONFIRMED', 'RECEIVED'] as const).map((status) => {
                      const count = orderCounts.data?.[status] ?? 0;
                      const total = Math.max(orderCounts.data?.total ?? 0, 1);
                      const width = Math.round((count / total) * 100);
                      return (
                        <div key={status}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <OrderStatusBadge status={status} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {formatNumber(count)}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                status === 'PENDING'
                                  ? 'bg-amber-400'
                                  : status === 'CONFIRMED'
                                    ? 'bg-sky-400'
                                    : 'bg-emerald-400'
                              }`}
                              style={{ width: `${Math.max(width, count > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Cancelled</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {formatNumber(orderCounts.data?.CANCELLED ?? 0)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Inventory mix" description="Value at cost by category." />
            <div className="space-y-3 p-5">
              {products.isLoading ? (
                <>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </>
              ) : categoryMix.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add products to see how inventory value is distributed.
                </p>
              ) : (
                categoryMix.map((category) => (
                  <div key={category.name}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {category.name}
                      </span>
                      <span className="shrink-0 text-slate-500 dark:text-slate-400">
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.round((category.value / maxCategoryValue) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {!canReadOrders ? (
            <Card>
              <CardHeader title="Quick actions" />
              <div className="grid gap-2 p-4">
                <Link
                  to="/stock"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
                >
                  <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                  Review stock movements
                </Link>
                <Link
                  to="/notifications"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Check alerts
                </Link>
                <Link
                  to="/products"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
                >
                  <Package className="h-4 w-4" aria-hidden="true" />
                  Browse the catalog
                </Link>
              </div>
            </Card>
          ) : (
            <div className="surface-muted p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Purchase order flow
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Pending → Confirmed → Received. Receiving an order updates stock atomically and
                writes one movement per line.
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                {orderCounts.data
                  ? `${formatNumber(orderCounts.data.RECEIVED)} received · ${formatNumber(orderCounts.data.CANCELLED)} cancelled`
                  : 'Loading totals…'}
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Inventory value uses each product&apos;s purchase price and current quantity. Alerts are
        evaluated against the minimum stock you set per product.
      </p>

      <StockMovementModal open={movementOpen} onClose={() => setMovementOpen(false)} />
    </div>
  );
}
