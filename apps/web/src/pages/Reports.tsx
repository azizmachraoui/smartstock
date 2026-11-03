import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Package,
  ShoppingCart,
  AlertTriangle,
  Download,
  TrendingDown,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { qk } from '../lib/queryKeys';
import { reportService, getAccessToken } from '../services/api';
import { formatCurrency, formatNumber, toDateInput, daysAgo } from '../utils/format';
import { getErrorMessage } from '../lib/errors';
import { useDocumentTitle } from '../hooks/useData';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { StatCard } from '../components/ui/StatCard';
import type { ReportParams } from '../types';

// ─── Date preset helpers ──────────────────────────────────────────────────────

type Preset = '7' | '30' | '90' | '365' | 'custom';

function presetToDates(preset: Preset, customFrom: string, customTo: string): ReportParams {
  if (preset === 'custom') {
    return { from: customFrom || undefined, to: customTo || undefined };
  }
  const days = parseInt(preset, 10);
  return {
    from: toDateInput(daysAgo(days - 1)),
    to: toDateInput(new Date()),
  };
}

// ─── Chart colour palette ─────────────────────────────────────────────────────

const COLORS = {
  in:         '#22c55e',  // green
  out:        '#ef4444',  // red
  adjustment: '#f59e0b',  // amber
  category:   '#6366f1',  // indigo
  supplier:   '#06b6d4',  // cyan
};

// ─── Reusable chart section wrapper ──────────────────────────────────────────

function ChartCard({
  title,
  description,
  action,
  isLoading,
  isError,
  isEmpty,
  onRetry,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <CardBody className="min-h-[280px]">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-52 w-full" />
          </div>
        ) : isError ? (
          <ErrorState message="Failed to load this chart" onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="No data for this period"
            description="Try selecting a wider date range."
          />
        ) : (
          children
        )}
      </CardBody>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Reports() {
  useDocumentTitle('Reports & Analytics');
  const { hasPermission } = useAuth();
  const { resolvedTheme } = useTheme();

  const canRead = hasPermission('analytics:read');

  const [preset, setPreset] = useState<Preset>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const params = presetToDates(preset, customFrom, customTo);

  const isDark = resolvedTheme === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  // ─── Queries ────────────────────────────────────────────────────────────────

  const inventoryQ = useQuery({
    queryKey: qk.reportInventory(),
    queryFn: reportService.inventory,
    enabled: canRead,
  });

  const movementsQ = useQuery({
    queryKey: qk.reportMovements(params),
    queryFn: () => reportService.movements(params),
    enabled: canRead,
  });

  const purchasesQ = useQuery({
    queryKey: qk.reportPurchases(params),
    queryFn: () => reportService.purchases(params),
    enabled: canRead,
  });

  const topProductsQ = useQuery({
    queryKey: qk.reportTopProducts(params),
    queryFn: () => reportService.topProducts({ ...params, limit: 10 }),
    enabled: canRead,
  });

  // ─── CSV download ────────────────────────────────────────────────────────────

  const downloadCsv = useCallback((type: string) => {
    const url = reportService.exportUrl(type, params);
    const token = getAccessToken();
    // Use a hidden anchor; attach Authorization header via a fetch-blob approach
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        if (!r.ok) throw new Error('Export failed');
        return r.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        const from = params.from ?? '';
        const to   = params.to   ?? '';
        a.download = `smartstock-${type}-${from}-${to}.csv`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => alert('Export failed. Please try again.'));
  }, [params]);

  // ─── Permission guard ─────────────────────────────────────────────────────

  if (!canRead) {
    return (
      <div className="surface p-12 text-center">
        <p className="text-slate-500">You don't have permission to access this page.</p>
      </div>
    );
  }

  // ─── Derived values ───────────────────────────────────────────────────────

  const inv = inventoryQ.data;
  const mov = movementsQ.data;
  const pur = purchasesQ.data;
  const top = topProductsQ.data;

  const movementChartData = (mov?.trend ?? []).map((d) => ({
    date: d.date,
    IN:          d.in.volume,
    OUT:         d.out.volume,
    ADJUSTMENT:  d.adjustment.volume,
  }));

  const categoryChartData = (inv?.valuationByCategory ?? []).slice(0, 10).map((c) => ({
    name: c.category.length > 18 ? c.category.slice(0, 17) + '…' : c.category,
    value: Math.round(c.totalValue),
  }));

  const supplierChartData = (pur?.bySupplier ?? []).slice(0, 10).map((s) => ({
    name: s.supplier.length > 18 ? s.supplier.slice(0, 17) + '…' : s.supplier,
    value: Math.round(s.totalAmount),
  }));

  const topProductsData = (top?.topProducts ?? []).slice(0, 10).map((p) => ({
    name: p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name,
    volume: p.totalVolume,
  }));

  const totalMovementVolume =
    (mov?.totals.in.volume ?? 0) +
    (mov?.totals.out.volume ?? 0) +
    (mov?.totals.adjustment.volume ?? 0);

  const currencyCode = 'USD'; // TODO: pull from SettingsContext once currency is applied app-wide

  // ─── Preset selector ─────────────────────────────────────────────────────

  const presets: { value: Preset; label: string }[] = [
    { value: '7',   label: 'Last 7 days' },
    { value: '30',  label: 'Last 30 days' },
    { value: '90',  label: 'Last 90 days' },
    { value: '365', label: 'Last year' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Reports & Analytics"
        description="Inventory insights and purchase performance"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => downloadCsv('inventory')}
          >
            Export Inventory CSV
          </Button>
        }
      />

      {/* Sales Revenue Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Sales revenue:</strong> Not available — SmartStock has no sales module. OUT stock
          movements are not sales and no revenue figure is shown.
        </span>
      </div>

      {/* Date Range Controls */}
      <Card>
        <CardBody className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0">Date range:</span>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    preset === p.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                <span className="text-xs text-slate-500">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Inventory Valuation */}
        {inventoryQ.isLoading ? (
          <div className="surface p-5"><Skeleton className="h-20 w-full" /></div>
        ) : inventoryQ.isError ? (
          <div className="surface p-5 flex flex-col gap-1">
            <p className="text-xs text-slate-500">Inventory Valuation</p>
            <p className="text-xs text-rose-500">{getErrorMessage(inventoryQ.error)}</p>
          </div>
        ) : (
          <StatCard
            label="Inventory Valuation"
            value={formatCurrency(inv?.totalValuation ?? 0, currencyCode)}
            hint={`${formatNumber(inv?.totalProducts ?? 0)} active products`}
            icon={<Package className="h-5 w-5" />}
            tone="sky"
          />
        )}

        {/* 2. Purchase Value (Received) */}
        {purchasesQ.isLoading ? (
          <div className="surface p-5"><Skeleton className="h-20 w-full" /></div>
        ) : purchasesQ.isError ? (
          <div className="surface p-5 flex flex-col gap-1">
            <p className="text-xs text-slate-500">Purchase Value (Received)</p>
            <p className="text-xs text-rose-500">{getErrorMessage(purchasesQ.error)}</p>
          </div>
        ) : (
          <StatCard
            label="Purchase Value (Received)"
            value={formatCurrency(pur?.totalAmount ?? 0, currencyCode)}
            hint={`${formatNumber(pur?.orderCount ?? 0)} received orders`}
            icon={<ShoppingCart className="h-5 w-5" />}
            tone="brand"
          />
        )}

        {/* 3. Low Stock + Out of Stock */}
        {inventoryQ.isLoading ? (
          <div className="surface p-5"><Skeleton className="h-20 w-full" /></div>
        ) : (
          <StatCard
            label="Low Stock Items"
            value={formatNumber(inv?.lowStockCount ?? 0)}
            hint={`${formatNumber(inv?.outOfStockCount ?? 0)} out of stock`}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="amber"
          />
        )}

        {/* 4. Movement Volume */}
        {movementsQ.isLoading ? (
          <div className="surface p-5"><Skeleton className="h-20 w-full" /></div>
        ) : movementsQ.isError ? (
          <div className="surface p-5 flex flex-col gap-1">
            <p className="text-xs text-slate-500">Total Movement Volume</p>
            <p className="text-xs text-rose-500">{getErrorMessage(movementsQ.error)}</p>
          </div>
        ) : (
          <StatCard
            label="Movement Volume"
            value={formatNumber(totalMovementVolume)}
            hint={`IN ${formatNumber(mov?.totals.in.volume ?? 0)} · OUT ${formatNumber(mov?.totals.out.volume ?? 0)}`}
            icon={<TrendingDown className="h-5 w-5" />}
            tone="violet"
          />
        )}
      </div>

      {/* ── Movement Totals Row ── */}
      {!movementsQ.isLoading && !movementsQ.isError && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Stock IN', icon: <ArrowDown className="h-4 w-4" />, volume: mov?.totals.in.volume ?? 0, count: mov?.totals.in.count ?? 0, color: 'text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400' },
            { label: 'Stock OUT', icon: <ArrowUp className="h-4 w-4" />, volume: mov?.totals.out.volume ?? 0, count: mov?.totals.out.count ?? 0, color: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400' },
            { label: 'Adjustments', icon: <RefreshCw className="h-4 w-4" />, volume: mov?.totals.adjustment.volume ?? 0, count: mov?.totals.adjustment.count ?? 0, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400' },
          ].map((item) => (
            <div key={item.label} className="surface px-4 py-3 flex items-center gap-3">
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
                {item.icon}
              </span>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(item.volume)}</p>
                <p className="text-xs text-slate-400">{formatNumber(item.count)} movements</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Stock Movement Trend */}
        <ChartCard
          title="Stock Movement Trend"
          description="Units moved per day (IN / OUT / ADJUSTMENT)"
          action={
            <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={() => downloadCsv('movements')}>
              CSV
            </Button>
          }
          isLoading={movementsQ.isLoading}
          isError={movementsQ.isError}
          isEmpty={movementChartData.length === 0}
          onRetry={() => movementsQ.refetch()}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={movementChartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: axisColor }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="IN"          fill={COLORS.in}         radius={[3,3,0,0]} maxBarSize={24} />
              <Bar dataKey="OUT"         fill={COLORS.out}        radius={[3,3,0,0]} maxBarSize={24} />
              <Bar dataKey="ADJUSTMENT"  fill={COLORS.adjustment} radius={[3,3,0,0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Products by Movement Volume */}
        <ChartCard
          title="Top Products by Movement"
          description="Total units moved in selected period"
          action={
            <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={() => downloadCsv('top-products')}>
              CSV
            </Button>
          }
          isLoading={topProductsQ.isLoading}
          isError={topProductsQ.isError}
          isEmpty={topProductsData.length === 0}
          onRetry={() => topProductsQ.refetch()}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topProductsData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: axisColor }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: axisColor }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
              />
              <Bar dataKey="volume" fill={COLORS.category} radius={[0,3,3,0]} maxBarSize={20} name="Volume" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Inventory Valuation by Category */}
        <ChartCard
          title="Inventory Valuation by Category"
          description="Current stock quantity × purchase price"
          action={
            <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={() => downloadCsv('inventory')}>
              CSV
            </Button>
          }
          isLoading={inventoryQ.isLoading}
          isError={inventoryQ.isError}
          isEmpty={categoryChartData.length === 0}
          onRetry={() => inventoryQ.refetch()}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryChartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisColor }} />
              <YAxis tick={{ fontSize: 10, fill: axisColor }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                formatter={(v: number) => [formatCurrency(v, currencyCode), 'Valuation']}
              />
              <Bar dataKey="value" fill={COLORS.category} radius={[3,3,0,0]} maxBarSize={32} name="Value" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Purchase Value by Supplier */}
        <ChartCard
          title="Purchase Value by Supplier"
          description="Received orders only (DRAFT, PENDING, CANCELLED excluded)"
          action={
            <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={() => downloadCsv('purchases')}>
              CSV
            </Button>
          }
          isLoading={purchasesQ.isLoading}
          isError={purchasesQ.isError}
          isEmpty={supplierChartData.length === 0}
          onRetry={() => purchasesQ.refetch()}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={supplierChartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: axisColor }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: axisColor }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                formatter={(v: number) => [formatCurrency(v, currencyCode), 'Amount']}
              />
              <Bar dataKey="value" fill={COLORS.supplier} radius={[0,3,3,0]} maxBarSize={20} name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Low Stock & Out of Stock Tables ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Low Stock */}
        <Card>
          <CardHeader
            title="Low Stock Items"
            description="Products at or below their minimum threshold"
            icon={<AlertTriangle className="h-4 w-4" />}
            action={<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">{inv?.lowStockCount ?? '—'}</span>}
          />
          <CardBody className="p-0">
            {inventoryQ.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : inventoryQ.isError ? (
              <ErrorState message={getErrorMessage(inventoryQ.error)} onRetry={() => inventoryQ.refetch()} />
            ) : (inv?.lowStock ?? []).length === 0 ? (
              <EmptyState icon={<Package className="h-6 w-6" />} title="No low-stock items" description="All products are above their minimum." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-shell">
                  <thead>
                    <tr>
                      <th>Product</th><th>SKU</th><th>Qty</th><th>Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inv?.lowStock ?? []).map((p) => (
                      <tr key={p._id}>
                        <td className="font-medium text-slate-900 dark:text-white">{p.name}</td>
                        <td className="font-mono text-xs">{p.sku}</td>
                        <td className="text-amber-600 font-semibold dark:text-amber-400">{p.quantity}</td>
                        <td className="text-slate-500">{p.minimumStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Out of Stock */}
        <Card>
          <CardHeader
            title="Out of Stock"
            description="Active products with zero quantity"
            icon={<Package className="h-4 w-4" />}
            action={<span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">{inv?.outOfStockCount ?? '—'}</span>}
          />
          <CardBody className="p-0">
            {inventoryQ.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : inventoryQ.isError ? (
              <ErrorState message={getErrorMessage(inventoryQ.error)} onRetry={() => inventoryQ.refetch()} />
            ) : (inv?.outOfStock ?? []).length === 0 ? (
              <EmptyState icon={<Package className="h-6 w-6" />} title="No out-of-stock items" description="All products have stock available." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-shell">
                  <thead>
                    <tr>
                      <th>Product</th><th>SKU</th><th>Category</th><th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inv?.outOfStock ?? []).map((p) => (
                      <tr key={p._id}>
                        <td className="font-medium text-slate-900 dark:text-white">{p.name}</td>
                        <td className="font-mono text-xs">{p.sku}</td>
                        <td className="text-slate-500">{p.category}</td>
                        <td>{formatCurrency(p.purchasePrice, currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
