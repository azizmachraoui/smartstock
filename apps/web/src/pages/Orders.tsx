import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderService, supplierService } from '../services/api';
import { formatCurrency, formatDateTime, formatDate } from '../utils/format';
import { Table, Badge, Button, Pagination, Input, Select, Modal } from '../components';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Edit, Eye, CheckCircle, XCircle, Truck } from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const orderStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

export default function Orders() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { success, error } = useToast();
  const canWrite = hasPermission('order:write');

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo] = useState('');
  const [sort] = useState('-createdAt');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; order: any; reason: string }>({ open: false, order: null, reason: '' });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sort };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (supplierFilter) params.supplier = supplierFilter;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await orderService.list(params);
      setOrders(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await supplierService.list({ isActive: true, limit: 100 });
      setSuppliers(res.data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
  }, [page, limit, sort, search, statusFilter, supplierFilter, dateFrom, dateTo]);

  const handleView = (id: string) => navigate(`/orders/${id}`);
  const handleEdit = (id: string) => navigate(`/orders/${id}/edit`);

  const handleConfirm = async (id: string) => {
    try {
      await orderService.confirm(id);
      success('Order confirmed');
      fetchOrders();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to confirm order');
    }
  };

  const handleReceive = async (id: string) => {
    try {
      await orderService.receive(id);
      success('Order received and stock updated');
      fetchOrders();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to receive order');
    }
  };

  const handleCancel = (order: any) => {
    setCancelDialog({ open: true, order, reason: '' });
  };

  const confirmCancel = async () => {
    if (!cancelDialog.order) return;
    try {
      await orderService.cancel(cancelDialog.order.id, cancelDialog.reason);
      success('Order cancelled');
      setCancelDialog({ open: false, order: null, reason: '' });
      fetchOrders();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to cancel order');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500">Manage purchase orders and supplier orders</p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate('/orders/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search order number..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && fetchOrders()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Select
            label="Status"
            options={statusOptions}
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
          />
          <Select
            label="Supplier"
            options={[{ value: '', label: 'All Suppliers' }, ...suppliers.map((s: any) => ({ value: s.id, label: s.name }))]}
            value={supplierFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSupplierFilter(e.target.value)}
          />
          <Input
            label="From Date"
            type="date"
            value={dateFrom}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <Table
          data={orders}
          columns={[
            { key: 'orderNumber', header: 'Order #', render: (item: any) => <span className="font-mono font-medium">{item.orderNumber}</span> },
            { key: 'supplier', header: 'Supplier', render: (item: any) => (
              <div>
                <p className="font-medium">{item.supplier?.name || 'Unknown'}</p>
                <p className="text-sm text-gray-500">{item.supplier?.company || ''}</p>
              </div>
            )},
            { key: 'status', header: 'Status', render: (item: any) => (
              <Badge variant={orderStatusColors[item.status] || 'gray'}>
                {item.status}
              </Badge>
            )},
            { key: 'items', header: 'Items', render: (item: any) => (
              <div className="text-sm">
                <p>{item.items?.length || 0} products</p>
                <p className="text-gray-500">{item.items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0} total units</p>
              </div>
            )},
            { key: 'totalAmount', header: 'Total', render: (item: any) => (
              <span className="font-medium">{formatCurrency(item.totalAmount)}</span>
            )},
            { key: 'expectedDate', header: 'Expected', render: (item: any) => item.expectedDate ? formatDate(item.expectedDate) : <span className="text-gray-400">—</span> },
            { key: 'createdBy', header: 'Created By', render: (item: any) => item.createdBy?.firstName ? `${item.createdBy.firstName} ${item.createdBy.lastName}` : '-' },
            { key: 'createdAt', header: 'Created', render: (item: any) => formatDateTime(item.createdAt) },
            { key: 'actions', header: 'Actions', render: (item: any) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleView(item.id)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {canWrite && item.status === 'PENDING' && (
                  <button
                    onClick={() => handleEdit(item.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                {canWrite && item.status === 'PENDING' && (
                  <button
                    onClick={() => handleConfirm(item.id)}
                    className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                    title="Confirm"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                {canWrite && item.status === 'CONFIRMED' && (
                  <button
                    onClick={() => handleReceive(item.id)}
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                    title="Receive"
                  >
                    <Truck className="w-4 h-4" />
                  </button>
                )}
                {canWrite && (item.status === 'PENDING' || item.status === 'CONFIRMED') && (
                  <button
                    onClick={() => handleCancel(item)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                    title="Cancel"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            ), className: 'w-48' },
          ]}
          keyExtractor={(item: any) => item.id}
          loading={loading}
          emptyMessage="No orders found"
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

      {/* Cancel Dialog */}
      <Modal
        isOpen={cancelDialog.open}
        onClose={() => setCancelDialog({ open: false, order: null, reason: '' })}
        title="Cancel Order"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to cancel order <strong>{cancelDialog.order?.orderNumber}</strong>?</p>
          <Input
            label="Reason (Optional)"
            value={cancelDialog.reason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCancelDialog({ ...cancelDialog, reason: e.target.value })}
            placeholder="Enter cancellation reason"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setCancelDialog({ open: false, order: null, reason: '' })}>Cancel</Button>
            <Button variant="danger" onClick={confirmCancel}>Confirm Cancellation</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}