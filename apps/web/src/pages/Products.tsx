import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  MoreHorizontal,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { DataColumn } from '../components/ui/DataTable';
import type { MessageResponse, Product, ProductParams } from '../types';
import { categoryService, productService, stockService } from '../services/api';
import { qk } from '../lib/queryKeys';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';
import { useAllProducts, useDebouncedValue, useDocumentTitle } from '../hooks/useData';
import { formatCurrency, formatNumber } from '../utils/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/DataTable';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/States';
import { StatCard } from '../components/ui/StatCard';
import { SearchInput, FilterBar } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Fields';
import { Badge, StockStatusBadge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/Modal';
import { ProductImage } from '../components/common/ProductImage';
import { StockMovementModal } from '../components/stock/StockMovementModal';

type StatusFilter = 'active' | 'inactive' | 'all';
type StockFilter = 'all' | 'low' | 'out';

const categoryName = (product: Product): string =>
  typeof product.category === 'object' ? product.category.name : '—';

const supplierName = (product: Product): string =>
  typeof product.supplier === 'object' ? product.supplier.name : '—';

export default function Products() {
  useDocumentTitle('Products');
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [stock, setStock] = useState<StockFilter>('all');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [movement, setMovement] = useState<{ open: boolean; product: Product | null; type: 'IN' | 'OUT' }>({
    open: false,
    product: null,
    type: 'IN',
  });
  const [confirm, setConfirm] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const canWrite = hasPermission('product:write');
  const canMoveStock = hasPermission('stock:write');

  const params: ProductParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      isActive: status === 'all' ? undefined : status === 'active',
      lowStock: stock === 'low' ? true : undefined,
      outOfStock: stock === 'out' ? true : undefined,
      category: category || undefined,
      sort,
      page,
      limit,
    }),
    [debouncedSearch, status, stock, category, sort, page, limit],
  );

  const products = useQuery({
    queryKey: qk.products(params),
    queryFn: () => productService.list(params),
    placeholderData: (previous) => previous,
  });

  const categories = useQuery({
    queryKey: qk.categories({ isActive: true, limit: 100 }),
    queryFn: () => categoryService.list({ isActive: true, limit: 100 }),
    staleTime: 120_000,
  });

  const alerts = useQuery({
    queryKey: qk.alerts,
    queryFn: stockService.alerts,
    staleTime: 60_000,
  });

  const inventory = useAllProducts('products-summary');

  const deactivate = useMutation<MessageResponse | Product, Error, Product>({
    mutationFn: (product: Product) =>
      product.isActive ? productService.deactivate(product.id) : productService.reactivate(product.id),
    onSuccess: (_result, product) => {
      toast.success(product.isActive ? `${product.name} deactivated` : `${product.name} reactivated`);
      setConfirm({ open: false, product: null });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['all-products'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const valuation = useMemo(() => {
    const rows = inventory.data?.data ?? [];
    return {
      units: rows.reduce((sum, product) => sum + product.quantity, 0),
      value: rows.reduce((sum, product) => sum + product.quantity * product.purchasePrice, 0),
    };
  }, [inventory.data]);

  const filterActive = status !== 'active' || Boolean(debouncedSearch) || stock !== 'all' || Boolean(category);

  const resetFilters = () => {
    setSearch('');
    setStatus('active');
    setStock('all');
    setCategory('');
    setSort('-createdAt');
    setPage(1);
  };

  const columns: DataColumn<Product>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (product) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductImage src={product.image} alt={product.name} className="h-10 w-10" />
          <div className="min-w-0">
            <Link
              to={`/products/${product.id}`}
              className="block max-w-[15rem] truncate text-sm font-semibold text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
            >
              {product.name}
            </Link>
            <p className="truncate text-[11px] text-slate-400">
              {product.sku}
              {product.barcode ? ` · ${product.barcode}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (product) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
            {categoryName(product)}
          </p>
          <p className="truncate text-[11px] text-slate-400">{supplierName(product)}</p>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'On hand',
      cell: (product) => (
        <div>
          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatNumber(product.quantity)}{' '}
            <span className="text-[11px] font-medium text-slate-400">{product.unit}</span>
          </p>
          <div className="mt-1">
            <StockStatusBadge status={product.stockStatus} />
          </div>
        </div>
      ),
    },
    {
      key: 'prices',
      header: 'Price',
      cell: (product) => (
        <div>
          <p className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(product.sellingPrice)}
          </p>
          <p className="text-[11px] tabular-nums text-slate-400">
            cost {formatCurrency(product.purchasePrice)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (product) =>
        product.isActive ? (
          <Badge variant="success" dot>
            Active
          </Badge>
        ) : (
          <Badge variant="neutral" dot>
            Inactive
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (product) => (
        <div className="flex items-center justify-end gap-1">
          {canMoveStock ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Receive stock for ${product.name}`}
                title="Stock in"
                onClick={() => setMovement({ open: true, product, type: 'IN' })}
                disabled={!product.isActive}
              >
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove stock for ${product.name}`}
                title="Stock out"
                onClick={() => setMovement({ open: true, product, type: 'OUT' })}
                disabled={!product.isActive}
              >
                <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="icon" aria-label={`View ${product.name}`} title="View"
            onClick={() => navigate(`/products/${product.id}`)}>
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
          {canWrite ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${product.name}`}
                title="Edit"
                onClick={() => navigate(`/products/${product.id}/edit`)}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  product.isActive ? `Deactivate ${product.name}` : `Reactivate ${product.name}`
                }
                title={product.isActive ? 'Deactivate' : 'Reactivate'}
                onClick={() => setConfirm({ open: true, product })}
              >
                {product.isActive ? (
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const target = confirm.product;
  const missingStock = target ? Math.max(target.minimumStock - target.quantity, 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Products"
        description="Every product, its stock position and pricing — kept in sync with the warehouse."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                void products.refetch();
                void alerts.refetch();
              }}
              leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            >
              Refresh
            </Button>
            {canWrite ? (
              <Link to="/products/new">
                <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>Add product</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Products"
          value={formatNumber(products.data?.total ?? 0)}
          hint="Matching the current filters"
          icon={<Package className="h-5 w-5" aria-hidden="true" />}
          tone="navy"
          loading={products.isLoading}
        />
        <StatCard
          label="Units on hand"
          value={formatNumber(valuation.units)}
          hint="Across active products"
          icon={<PackagePlus className="h-5 w-5" aria-hidden="true" />}
          tone="sky"
          loading={inventory.isLoading}
        />
        <StatCard
          label="Inventory value"
          value={formatCurrency(valuation.value)}
          hint="At purchase cost"
          icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
          tone="brand"
          loading={inventory.isLoading}
        />
        <StatCard
          label="Stock alerts"
          value={formatNumber(alerts.data?.summary.total ?? 0)}
          hint={
            alerts.isLoading
              ? 'Checking thresholds…'
              : `${alerts.data?.summary.lowStock ?? 0} low · ${alerts.data?.summary.outOfStock ?? 0} out`
          }
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          tone={alerts.data && alerts.data.summary.total > 0 ? 'rose' : 'amber'}
          loading={alerts.isLoading}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-sm">
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search name, SKU or barcode…"
              label="Search products"
            />
          </div>
          <FilterBar>
            <Select
              aria-label="Filter by category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All categories' },
                ...(categories.data?.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
              className="!w-auto min-w-[10rem]"
            />
            <Select
              aria-label="Filter by stock state"
              value={stock}
              onChange={(event) => {
                setStock(event.target.value as StockFilter);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'Any stock level' },
                { value: 'low', label: 'At or below minimum' },
                { value: 'out', label: 'Out of stock' },
              ]}
              className="!w-auto min-w-[10rem]"
            />
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
              options={[
                { value: 'active', label: 'Active only' },
                { value: 'inactive', label: 'Inactive only' },
                { value: 'all', label: 'All statuses' },
              ]}
              className="!w-auto min-w-[9rem]"
            />
            <Select
              aria-label="Sort products"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              options={[
                { value: '-createdAt', label: 'Newest first' },
                { value: 'name', label: 'Name A–Z' },
                { value: '-quantity', label: 'Most stock' },
                { value: 'quantity', label: 'Least stock' },
                { value: '-sellingPrice', label: 'Highest price' },
              ]}
              className="!w-auto min-w-[9.5rem]"
            />
            {filterActive ? (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            ) : null}
          </FilterBar>
        </div>

        <DataTable
          caption="Products"
          columns={columns}
          rows={products.data?.data}
          rowKey={(product) => product.id}
          loading={products.isLoading}
          error={products.error}
          onRetry={() => void products.refetch()}
          empty={
            <EmptyState
              icon={<Package className="h-6 w-6" aria-hidden="true" />}
              title={filterActive ? 'No products match these filters' : 'No products yet'}
              description={
                filterActive
                  ? 'Try a broader search, or reset the filters to see the full catalog.'
                  : 'Add your first product to start tracking stock, value and alerts.'
              }
              action={
                filterActive ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Reset filters
                  </Button>
                ) : canWrite ? (
                  <Link to="/products/new">
                    <Button leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                      Add product
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          }
        />

        {(products.data?.total ?? 0) > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Pagination
              page={products.data?.page ?? 1}
              pages={products.data?.pages ?? 1}
              total={products.data?.total ?? 0}
              limit={products.data?.limit ?? limit}
              onPageChange={setPage}
              disabled={products.isFetching}
            />
            <div className="flex items-center gap-2 px-4 pb-3 sm:pb-0 sm:pr-5">
              <label htmlFor="products-page-size" className="text-xs text-slate-500 dark:text-slate-400">
                Rows
              </label>
              <select
                id="products-page-size"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-navy-950 dark:text-slate-200"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </Card>

      <StockMovementModal
        open={movement.open}
        onClose={() => setMovement({ open: false, product: null, type: 'IN' })}
        defaultProduct={movement.product}
        defaultType={movement.type}
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, product: null })}
        onConfirm={() => target && deactivate.mutate(target)}
        title={target?.isActive ? `Deactivate ${target.name}?` : `Reactivate ${target?.name ?? ''}?`}
        description={
          target?.isActive
            ? 'Inactive products stay in history, but cannot be added to new purchase orders or receive stock. You can reactivate at any time.'
            : 'The product becomes available again for purchasing and stock movements.'
        }
        confirmLabel={target?.isActive ? 'Deactivate product' : 'Reactivate product'}
        tone={target?.isActive ? 'danger' : 'primary'}
        loading={deactivate.isPending}
      >
        {target?.isActive && missingStock > 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            This product is {formatNumber(missingStock)} {target.unit} below its minimum stock level.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
