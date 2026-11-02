import React, { useEffect, useState } from 'react';
import { productService, stockService } from '../services/api';
import { formatDateTime } from '../utils/format';
import { Table, Badge, Button, Pagination, Input, Select, Modal } from '../components';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { Search, ArrowUp, ArrowDown, Minus, Package } from 'lucide-react';

const movementTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'IN', label: 'Stock IN' },
  { value: 'OUT', label: 'Stock OUT' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
];

export default function Stock() {
  const { hasPermission } = useAuth();
  const { success, error } = useToast();
  const canStockWrite = hasPermission('stock:write');
  const canStockAdjust = hasPermission('stock:adjust');

  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [referenceFilter, setReferenceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort] = useState('-createdAt');
  const [alerts, setAlerts] = useState<any>(null);
  const [movementDialog, setMovementDialog] = useState<{ open: boolean; type: 'IN' | 'OUT' | 'ADJUSTMENT'; product: any }>({ open: false, type: 'IN', product: null });
  const [movementForm, setMovementForm] = useState({ quantity: '', reason: '', reference: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sort };
      if (productFilter) params.product = productFilter;
      if (typeFilter) params.type = typeFilter;
      if (referenceFilter) params.reference = referenceFilter;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await stockService.movements(params);
      setMovements(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await productService.list({ isActive: true, limit: 1000 });
      setProducts(res.data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await stockService.alerts();
      setAlerts(res);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  };

  useEffect(() => {
    fetchMovements();
    fetchProducts();
    fetchAlerts();
  }, [page, limit, sort, productFilter, typeFilter, referenceFilter, dateFrom, dateTo]);

  const openMovementDialog = (type: 'IN' | 'OUT' | 'ADJUSTMENT', product?: any) => {
    setMovementDialog({ open: true, type, product: product || null });
    setMovementForm({ quantity: '', reason: '', reference: '' });
  };

  const handleMovementSubmit = async () => {
    if (!movementDialog.product) return;
    setSubmitting(true);
    try {
      const data = {
        product: movementDialog.product.id,
        quantity: parseInt(movementForm.quantity),
        reason: movementForm.reason,
        reference: movementForm.reference,
      };
      if (movementDialog.type === 'IN') {
        await stockService.stockIn(data);
      } else if (movementDialog.type === 'OUT') {
        await stockService.stockOut(data);
      } else {
        await stockService.adjust({ ...data, newQuantity: parseInt(movementForm.quantity) });
      }
      success(`Stock ${movementDialog.type} recorded`);
      setMovementDialog({ open: false, type: 'IN', product: null });
      fetchMovements();
      fetchAlerts();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to record movement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
          <p className="text-gray-500">Track inventory movements and stock levels</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canStockWrite && (
            <Button onClick={() => openMovementDialog('IN')}>
              <ArrowUp className="w-4 h-4 mr-2" />
              Stock IN
            </Button>
          )}
          {canStockWrite && (
            <Button variant="secondary" onClick={() => openMovementDialog('OUT')}>
              <ArrowDown className="w-4 h-4 mr-2" />
              Stock OUT
            </Button>
          )}
          {canStockAdjust && (
            <Button variant="ghost" onClick={() => openMovementDialog('ADJUSTMENT')}>
              <Minus className="w-4 h-4 mr-2" />
              Adjustment
            </Button>
          )}
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts?.summary?.total > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-yellow-800">Low Stock Alerts</p>
                <p className="text-sm text-yellow-700">
                  {alerts.summary.outOfStock} out of stock, {alerts.summary.lowStock} low stock items
                </p>
              </div>
            </div>
            <Badge variant="warning">{alerts.summary.total} items need attention</Badge>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search reference..."
              value={referenceFilter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferenceFilter(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && fetchMovements()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Select
            label="Product"
            options={[{ value: '', label: 'All Products' }, ...products.map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku})` }))]}
            value={productFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProductFilter(e.target.value)}
          />
          <Select
            label="Type"
            options={movementTypeOptions}
            value={typeFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value)}
          />
          <Input
            label="From Date"
            type="date"
            value={dateFrom}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
          />
          <Input
            label="To Date"
            type="date"
            value={dateTo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Movements Table */}
      <div className="card">
        <Table
          data={movements}
          columns={[
            { key: 'type', header: 'Type', render: (item: any) => (
              <Badge variant={item.type === 'IN' ? 'success' : item.type === 'OUT' ? 'danger' : 'info'}>
                {item.type === 'IN' && <ArrowUp className="w-3 h-3 mr-1" />}
                {item.type === 'OUT' && <ArrowDown className="w-3 h-3 mr-1" />}
                {item.type === 'ADJUSTMENT' && <Minus className="w-3 h-3 mr-1" />}
                {item.type}
              </Badge>
            )},
            { key: 'product', header: 'Product', render: (item: any) => (
              <div>
                <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                <p className="text-sm text-gray-500">{item.product?.sku}</p>
              </div>
            )},
            { key: 'quantity', header: 'Qty', render: (item: any) => (
              <span className={item.type === 'IN' ? 'text-green-600' : item.type === 'OUT' ? 'text-red-600' : 'text-blue-600'}>
                {item.type === 'IN' ? '+' : item.type === 'OUT' ? '-' : '→'} {item.quantity}
              </span>
            )},
            { key: 'stock', header: 'Stock', render: (item: any) => (
              <div className="text-right">
                <p className="font-medium">{item.newQuantity}</p>
                <p className="text-xs text-gray-500">was {item.previousQuantity}</p>
              </div>
            )},
            { key: 'reason', header: 'Reason' },
            { key: 'reference', header: 'Reference' },
            { key: 'user', header: 'User', render: (item: any) => (
              item.user?.firstName ? `${item.user.firstName} ${item.user.lastName}` : '-'
            )},
            { key: 'createdAt', header: 'Date', render: (item: any) => formatDateTime(item.createdAt) },
          ]}
          keyExtractor={(item: any) => item.id}
          loading={loading}
          emptyMessage="No stock movements recorded"
        />
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / limit)}
          onPageChange={setPage}
          showPageSize
          pageSize={limit}
          onPageSizeChange={setLimit}
        />
      </div>

      {/* Movement Dialog */}
      <Modal
        isOpen={movementDialog.open}
        onClose={() => setMovementDialog({ open: false, type: 'IN', product: null })}
        title={`${movementDialog.type === 'IN' ? 'Stock IN' : movementDialog.type === 'OUT' ? 'Stock OUT' : 'Stock Adjustment'} ${movementDialog.product ? `- ${movementDialog.product.name}` : ''}`}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Product"
            options={[{ value: '', label: 'Select product' }, ...products.map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku}) - Stock: ${p.quantity} ${p.unit}` }))]}
            value={movementDialog.product?.id || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const product = products.find(p => p.id === e.target.value);
              setMovementDialog({ ...movementDialog, product });
            }}
            required={!movementDialog.product}
          />
          {movementDialog.product && (
            <div>
              <label className="label">Current Stock</label>
              <div className="bg-gray-50 px-3 py-2 border border-gray-300 rounded-lg font-mono text-lg">
                {movementDialog.product.quantity} {movementDialog.product.unit}
                <span className="ml-2 text-sm text-gray-500 font-normal">(Min: {movementDialog.product.minimumStock})</span>
              </div>
            </div>
          )}
          <Input
            label={movementDialog.type === 'ADJUSTMENT' ? 'New Quantity' : 'Quantity'}
            type="number"
            step="1"
            min="0"
            value={movementForm.quantity}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMovementForm({ ...movementForm, quantity: e.target.value })}
            placeholder={movementDialog.type === 'ADJUSTMENT' ? 'Enter new total quantity' : 'Enter quantity'}
            required
          />
          <Input
            label="Reason"
            value={movementForm.reason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMovementForm({ ...movementForm, reason: e.target.value })}
            placeholder="e.g., Purchase order received, Customer sale, Inventory count"
            required
          />
          <Input
            label="Reference (Optional)"
            value={movementForm.reference}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMovementForm({ ...movementForm, reference: e.target.value })}
            placeholder="e.g., PO-2024-001, INV-12345"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setMovementDialog({ open: false, type: 'IN', product: null })}>Cancel</Button>
            <Button onClick={handleMovementSubmit} loading={submitting} disabled={!movementForm.quantity || !movementDialog.product}>
              Record
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}