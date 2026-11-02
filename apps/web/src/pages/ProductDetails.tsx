import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService, stockService } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/format';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { Table, Badge, Button, Modal, Card, Input, StockStatusBadge } from '../components';
import { ArrowLeft, Edit, ArrowUp, ArrowDown, Minus } from 'lucide-react';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { success, error } = useToast();
  const canWrite = hasPermission('product:write');
  const canStockWrite = hasPermission('stock:write');
  const canStockAdjust = hasPermission('stock:adjust');

  const [product, setProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementDialog, setMovementDialog] = useState<{ open: boolean; type: 'IN' | 'OUT' | 'ADJUSTMENT'; product: any }>({ open: false, type: 'IN', product: null });
  const [movementForm, setMovementForm] = useState({ quantity: '', reason: '', reference: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await productService.get(id!);
        setProduct(res);
      } catch (err: any) {
        error(err.response?.data?.message || 'Failed to load product');
        navigate('/products');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  useEffect(() => {
    if (product) {
      const fetchMovements = async () => {
        setMovementsLoading(true);
        try {
          const res = await stockService.movements({ product: product.id, limit: 50 });
          setMovements(res.data || []);
        } catch (err) {
          console.error('Failed to load movements:', err);
        } finally {
          setMovementsLoading(false);
        }
      };
      fetchMovements();
    }
  }, [product]);

  const openMovementDialog = (type: 'IN' | 'OUT' | 'ADJUSTMENT') => {
    setMovementDialog({ open: true, type, product: product! });
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
      // Refresh product data
      const res = await productService.get(id!);
      setProduct(res);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to record movement');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/products')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-500">SKU: {product.sku}</span>
              {product.barcode && <span className="text-gray-500">Barcode: {product.barcode}</span>}
              <StockStatusBadge status={product.stockStatus} />
              <Badge variant={product.isActive ? 'success' : 'gray'}>{product.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          </div>
        </div>
        {canWrite && (
          <Button onClick={() => navigate(`/products/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      {/* Product Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <p className="text-sm text-gray-500">Category</p>
          <p className="font-medium text-gray-900">{product.category?.name || '-'}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Supplier</p>
          <p className="font-medium text-gray-900">{product.supplier?.name || '-'}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Unit</p>
          <p className="font-medium text-gray-900">{product.unit}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Min / Max Stock</p>
          <p className="font-medium text-gray-900">{product.minimumStock} / {product.maximumStock || '∞'}</p>
        </Card>
      </div>

      {/* Pricing & Stock */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500">Purchase Price</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(product.purchasePrice)}</p>
        </Card>
        <Card className="p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Selling Price</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(product.sellingPrice)}</p>
        </Card>
        <Card className="p-6 border-l-4 border-purple-500">
          <p className="text-sm text-gray-500">Current Stock</p>
          <p className="text-2xl font-bold text-gray-900">{product.quantity} {product.unit}</p>
        </Card>
      </div>

      {/* Stock Actions */}
      {(canStockWrite || canStockAdjust) && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stock Actions</h2>
          <div className="flex flex-wrap gap-3">
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
        </Card>
      )}

      {/* Stock Movements History */}
      <Card>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Stock Movement History</h2>
        </div>
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
          loading={movementsLoading}
          emptyMessage="No stock movements recorded"
        />
      </Card>

      {/* Movement Dialog */}
      <Modal
        isOpen={movementDialog.open}
        onClose={() => setMovementDialog({ open: false, type: 'IN', product: null })}
        title={`${movementDialog.type === 'IN' ? 'Stock IN' : movementDialog.type === 'OUT' ? 'Stock OUT' : 'Stock Adjustment'} - ${movementDialog.product?.name}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Current Stock</label>
            <div className="bg-gray-50 px-3 py-2 border border-gray-300 rounded-lg font-mono text-lg">
              {movementDialog.product?.quantity} {movementDialog.product?.unit}
            </div>
          </div>
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
            <Button onClick={handleMovementSubmit} loading={submitting} disabled={!movementForm.quantity}>
              Record
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}