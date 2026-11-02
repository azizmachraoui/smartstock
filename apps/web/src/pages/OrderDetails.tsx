import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderService } from '../services/api';
import { formatCurrency, formatDateTime, formatDate } from '../utils/format';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Modal, Card, Input } from '../components';
import { ArrowLeft, CheckCircle, XCircle, Truck, Edit } from 'lucide-react';

const orderStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { success, error } = useToast();
  const canWrite = hasPermission('order:write');

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; reason: string }>({ open: false, reason: '' });

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const res = await orderService.get(id!);
        setOrder(res);
      } catch (err: any) {
        error(err.response?.data?.message || 'Failed to load order');
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, navigate]);

  const handleConfirm = async () => {
    setActionLoading('confirm');
    try {
      await orderService.confirm(id!);
      success('Order confirmed');
      const res = await orderService.get(id!);
      setOrder(res);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to confirm order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReceive = async () => {
    setActionLoading('receive');
    try {
      await orderService.receive(id!);
      success('Order received and stock updated');
      const res = await orderService.get(id!);
      setOrder(res);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to receive order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = () => {
    setCancelDialog({ open: true, reason: '' });
  };

  const confirmCancel = async () => {
    setActionLoading('cancel');
    try {
      await orderService.cancel(id!, cancelDialog.reason);
      success('Order cancelled');
      const res = await orderService.get(id!);
      setOrder(res);
      setCancelDialog({ open: false, reason: '' });
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = () => navigate(`/orders/${id}/edit`);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const statusActions = {
    PENDING: [
      { label: 'Confirm', onClick: handleConfirm, icon: <CheckCircle className="w-4 h-4" />, variant: 'primary' as const },
      { label: 'Cancel', onClick: handleCancel, icon: <XCircle className="w-4 h-4" />, variant: 'danger' as const },
    ],
    CONFIRMED: [
      { label: 'Receive', onClick: handleReceive, icon: <Truck className="w-4 h-4" />, variant: 'primary' as const },
      { label: 'Cancel', onClick: handleCancel, icon: <XCircle className="w-4 h-4" />, variant: 'danger' as const },
    ],
    RECEIVED: [],
    CANCELLED: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant={orderStatusColors[order.status] || 'gray'}>{order.status}</Badge>
              <span className="text-gray-500">Supplier: {order.supplier?.name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && order.status === 'PENDING' && (
            <Button variant="secondary" onClick={handleEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          {((statusActions as any)[order.status] || []).map((action: any, index: number) => (
            <Button
              key={index}
              variant={action.variant}
              onClick={action.onClick}
              loading={actionLoading === action.label.toLowerCase()}
            >
              {action.icon}
              <span className="ml-2">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Order Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <p className="text-sm text-gray-500">Order Number</p>
          <p className="font-mono font-medium text-gray-900">{order.orderNumber}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Created</p>
          <p className="font-medium text-gray-900">{formatDateTime(order.createdAt)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Expected Delivery</p>
          <p className="font-medium text-gray-900">{order.expectedDate ? formatDate(order.expectedDate) : <span className="text-gray-400">Not set</span>}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(order.totalAmount)}</p>
        </Card>
      </div>

      {/* Supplier & Created By */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier</h3>
          <div>
            <p className="font-medium text-gray-900">{order.supplier?.name}</p>
            {order.supplier?.company && <p className="text-gray-500">{order.supplier.company}</p>}
            {order.supplier?.email && <p className="text-gray-500">{order.supplier.email}</p>}
            {order.supplier?.phone && <p className="text-gray-500">{order.supplier.phone}</p>}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Created By</h3>
          <div>
            <p className="font-medium text-gray-900">{order.createdBy?.firstName} {order.createdBy?.lastName}</p>
            <p className="text-gray-500">Created: {formatDateTime(order.createdAt)}</p>
            {order.confirmedAt && <p className="text-gray-500">Confirmed: {formatDateTime(order.confirmedAt)}</p>}
            {order.receivedAt && <p className="text-gray-500">Received: {formatDateTime(order.receivedAt)}</p>}
            {order.cancelledAt && <p className="text-red-600">Cancelled: {formatDateTime(order.cancelledAt)}</p>}
          </div>
        </Card>
      </div>

      {/* Notes */}
      {order.notes && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{order.notes}</p>
        </Card>
      )}

      {/* Order Items */}
      <Card>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
          <span className="badge-gray">{order.items?.length || 0} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {order.items?.map((item: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">{item.product?.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-right">{item.quantity} {item.product?.unit || ''}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td className="px-4 py-3 text-right" colSpan={3}>Order Total:</td>
                <td className="px-4 py-3 text-right text-lg">{formatCurrency(order.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Status History */}
      <Card>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Status History</h2>
        </div>
        <div className="p-4 space-y-4">
          <StatusStep 
            label="Order Created" 
            time={order.createdAt} 
            user={order.createdBy}
            completed 
            current={order.status === 'PENDING'}
          />
          <StatusStep 
            label="Confirmed" 
            time={order.confirmedAt} 
            user={order.createdBy}
            completed={['CONFIRMED', 'RECEIVED'].includes(order.status)}
            current={order.status === 'CONFIRMED'}
          />
          <StatusStep 
            label="Received" 
            time={order.receivedAt} 
            user={order.receivedBy}
            completed={order.status === 'RECEIVED'}
            current={order.status === 'RECEIVED'}
          />
          <StatusStep 
            label="Cancelled" 
            time={order.cancelledAt} 
            completed={order.status === 'CANCELLED'}
            current={order.status === 'CANCELLED'}
            reason={order.cancelReason}
          />
        </div>
      </Card>

      {/* Cancel Dialog */}
      <Modal
        isOpen={cancelDialog.open}
        onClose={() => setCancelDialog({ open: false, reason: '' })}
        title="Cancel Order"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to cancel order <strong>{order.orderNumber}</strong>?</p>
          <Input
            label="Reason (Optional)"
            value={cancelDialog.reason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCancelDialog({ open: true, reason: e.target.value })}
            placeholder="Enter cancellation reason"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setCancelDialog({ open: false, reason: '' })}>Cancel</Button>
            <Button variant="danger" onClick={confirmCancel} loading={actionLoading === 'cancel'}>Confirm Cancellation</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatusStep({ label, time, user, completed, current, reason }: any) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full border-2 ${completed ? 'bg-primary-600 border-primary-600' : current ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-300'} z-10`} />
        {!current && !completed && <div className="w-0.5 h-16 bg-gray-200 mt-1" />}
        {completed && <div className="w-0.5 h-16 bg-primary-200 mt-1" />}
      </div>
      <div className="flex-1 pt-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${completed || current ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
          {current && <Badge variant="info" className="text-xs">Current</Badge>}
        </div>
        {time && (
          <p className="text-sm text-gray-500 mt-1">
            {formatDateTime(time)}
            {user && <span className="ml-2">by {user.firstName} {user.lastName}</span>}
          </p>
        )}
        {reason && <p className="text-sm text-red-600 mt-1">Reason: {reason}</p>}
      </div>
    </div>
  );
}