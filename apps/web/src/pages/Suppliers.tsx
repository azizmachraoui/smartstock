import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supplierService } from '../services/api';
import { Table, Badge, Button, Pagination, Input, Select, Modal, ConfirmDialog } from '../components';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Edit, Trash2, RotateCcw } from 'lucide-react';

export default function Suppliers() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { success, error } = useToast();
  const canWrite = hasPermission('supplier:write');

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [sort] = useState('name');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; supplier: any }>({ open: false, supplier: null });
  const [formDialog, setFormDialog] = useState<{ open: boolean; supplier: any }>({ open: false, supplier: null });
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '', company: '', taxNumber: '', isActive: true
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sort };
      if (search) params.search = search;
      if (statusFilter) params.isActive = statusFilter;
      if (companyFilter) params.company = companyFilter;
      const res = await supplierService.list(params);
      setSuppliers(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [page, limit, sort, search, statusFilter, companyFilter]);

  const openFormDialog = (supplier?: any) => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        company: supplier.company || '',
        taxNumber: supplier.taxNumber || '',
        isActive: supplier.isActive,
      });
      setFormDialog({ open: true, supplier });
    } else {
      setFormData({ name: '', email: '', phone: '', address: '', company: '', taxNumber: '', isActive: true });
      setFormDialog({ open: true, supplier: null });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (formDialog.supplier) {
        await supplierService.update(formDialog.supplier.id, formData);
        success('Supplier updated');
      } else {
        await supplierService.create(formData);
        success('Supplier created');
      }
      setFormDialog({ open: false, supplier: null });
      fetchSuppliers();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to save supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (supplier: any) => {
    setDeleteDialog({ open: true, supplier });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.supplier) return;
    try {
      await supplierService.delete(deleteDialog.supplier.id);
      success('Supplier deactivated');
      setDeleteDialog({ open: false, supplier: null });
      fetchSuppliers();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to deactivate supplier');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await supplierService.reactivate(id);
      success('Supplier reactivated');
      fetchSuppliers();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to reactivate supplier');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-500">Manage your suppliers</p>
        </div>
        {canWrite && (
          <Button onClick={() => openFormDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchSuppliers()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Select
            label="Status"
            options={[
              { value: '', label: 'All Status' },
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
          />
          <Input
            label="Company"
            value={companyFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyFilter(e.target.value)}
            placeholder="Filter by company"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="card">
        <Table
          data={suppliers}
          columns={[
            { key: 'name', header: 'Name', render: (item: any) => <span className="font-medium">{item.name}</span> },
            { key: 'company', header: 'Company', render: (item: any) => item.company || <span className="text-gray-400">—</span> },
            { key: 'email', header: 'Email', render: (item: any) => item.email || <span className="text-gray-400">—</span> },
            { key: 'phone', header: 'Phone', render: (item: any) => item.phone || <span className="text-gray-400">—</span> },
            { key: 'stats', header: 'Stats', render: (item: any) => (
              <div className="text-sm">
                <p>{item.stats?.productCount || 0} products</p>
                <p className="text-gray-500">{item.stats?.orderCount || 0} orders</p>
              </div>
            )},
            { key: 'isActive', header: 'Status', render: (item: any) => (
              <Badge variant={item.isActive ? 'success' : 'gray'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )},
            { key: 'actions', header: 'Actions', render: (item: any) => (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/suppliers/${item.id}/edit`)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {item.isActive ? (
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                    title="Deactivate"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleReactivate(item.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-green-50 hover:text-green-600"
                    title="Reactivate"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            ), className: 'w-32' },
          ]}
          keyExtractor={(item: any) => item.id}
          loading={loading}
          emptyMessage="No suppliers found"
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

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, supplier: null })}
        onConfirm={confirmDelete}
        title="Deactivate Supplier"
        message={`Are you sure you want to deactivate "${deleteDialog.supplier?.name}"?`}
        confirmText="Deactivate"
      />

      {/* Form Dialog */}
      <Modal
        isOpen={formDialog.open}
        onClose={() => setFormDialog({ open: false, supplier: null })}
        title={formDialog.supplier ? 'Edit Supplier' : 'New Supplier'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Supplier name"
              required
            />
            <Input
              label="Company"
              value={formData.company}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Company name"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 234 567 890"
            />
          </div>
          <Input
            label="Tax Number"
            value={formData.taxNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, taxNumber: e.target.value })}
            placeholder="Tax/VAT number"
          />
          <div>
            <label className="label">Address</label>
            <textarea
              value={formData.address}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional address"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setFormDialog({ open: false, supplier: null })}>Cancel</Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!formData.name.trim()}>
              {formDialog.supplier ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}