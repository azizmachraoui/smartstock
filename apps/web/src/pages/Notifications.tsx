import { useEffect, useState } from 'react';
import { notificationService } from '../services/api';
import { formatDateTime } from '../utils/format';
import { Table, Badge, Button, Pagination, Modal } from '../components';
import { useToast } from '../hooks/useToast';
import { Bell, Check, CheckCircle2, Eye } from 'lucide-react';

export default function Notifications() {
  const { success, error } = useToast();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isReadFilter, setIsReadFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; notification: any }>({ open: false, notification: null });

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (isReadFilter) params.isRead = isReadFilter;
      if (resolvedFilter) params.resolved = resolvedFilter;
      if (typeFilter) params.type = typeFilter;
      const res = await notificationService.list(params);
      setNotifications(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await notificationService.unreadCount();
      setUnreadCount(res.count || 0);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [page, limit, isReadFilter, resolvedFilter, typeFilter]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
      fetchUnreadCount();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      success('All notifications marked as read');
      fetchNotifications();
      fetchUnreadCount();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to mark all as read');
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'LOW_STOCK': return <Badge variant="warning">Low Stock</Badge>;
      case 'OUT_OF_STOCK': return <Badge variant="danger">Out of Stock</Badge>;
      default: return <Badge variant="info">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500">Manage your notifications and alerts</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllRead}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <span className="badge-info">{unreadCount} unread</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select
            value={isReadFilter}
            onChange={(e) => setIsReadFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Read Status</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>
          <select
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Resolution</option>
            <option value="false">Active</option>
            <option value="true">Resolved</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Types</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="card">
        <Table
          data={notifications}
          columns={[
            { key: 'type', header: 'Type', render: (item: any) => getTypeBadge(item.type) },
            { key: 'title', header: 'Title', render: (item: any) => (
              <div className={item.isRead ? '' : 'font-medium'}>
                <p>{item.title}</p>
                <p className="text-sm text-gray-500 truncate max-w-xs">{item.message}</p>
              </div>
            )},
            { key: 'relatedProduct', header: 'Product', render: (item: any) => (
              item.relatedProduct ? (
                <div>
                  <p className="font-medium">{item.relatedProduct.name}</p>
                  <p className="text-sm text-gray-500">{item.relatedProduct.sku}</p>
                </div>
              ) : <span className="text-gray-400">—</span>
            )},
            { key: 'isRead', header: 'Read', render: (item: any) => (
              <Badge variant={item.isRead ? 'success' : 'warning'}>
                {item.isRead ? <Check className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                {item.isRead ? 'Read' : 'Unread'}
              </Badge>
            )},
            { key: 'resolved', header: 'Status', render: (item: any) => (
              <Badge variant={item.resolved ? 'success' : 'warning'}>
                {item.resolved ? 'Resolved' : 'Active'}
              </Badge>
            )},
            { key: 'createdAt', header: 'Created', render: (item: any) => formatDateTime(item.createdAt) },
            { key: 'actions', header: 'Actions', render: (item: any) => (
              <div className="flex items-center gap-2">
                {!item.isRead && (
                  <button
                    onClick={() => handleMarkRead(item.id)}
                    className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setDetailDialog({ open: true, notification: item })}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            ), className: 'w-32' },
          ]}
          keyExtractor={(item: any) => item.id}
          loading={loading}
          emptyMessage="No notifications found"
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

      {/* Detail Dialog */}
      <Modal
        isOpen={detailDialog.open}
        onClose={() => setDetailDialog({ open: false, notification: null })}
        title="Notification Details"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Type</p>
            <p className="font-medium">{getTypeBadge(detailDialog.notification?.type)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Title</p>
            <p className="font-medium">{detailDialog.notification?.title}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Message</p>
            <p className="text-gray-700 whitespace-pre-wrap">{detailDialog.notification?.message}</p>
          </div>
          {detailDialog.notification?.relatedProduct && (
            <div>
              <p className="text-sm text-gray-500">Related Product</p>
              <p className="font-medium">{detailDialog.notification.relatedProduct.name}</p>
              <p className="text-sm text-gray-500">SKU: {detailDialog.notification.relatedProduct.sku} | Stock: {detailDialog.notification.relatedProduct.quantity} {detailDialog.notification.relatedProduct.unit} (Min: {detailDialog.notification.relatedProduct.minimumStock})</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium">
                <Badge variant={detailDialog.notification?.isRead ? 'success' : 'warning'}>
                  {detailDialog.notification?.isRead ? 'Read' : 'Unread'}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Resolution</p>
              <p className="font-medium">
                <Badge variant={detailDialog.notification?.resolved ? 'success' : 'warning'}>
                  {detailDialog.notification?.resolved ? 'Resolved' : 'Active'}
                </Badge>
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium">{formatDateTime(detailDialog.notification?.createdAt)}</p>
          </div>
          {detailDialog.notification?.resolvedAt && (
            <div>
              <p className="text-sm text-gray-500">Resolved</p>
              <p className="font-medium">{formatDateTime(detailDialog.notification.resolvedAt)}</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDetailDialog({ open: false, notification: null })}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}