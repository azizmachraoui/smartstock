import React, { useEffect, useState } from 'react';
import { categoryService } from '../services/api';
import { Table, Badge, Button, Pagination, Input, Select, Modal } from '../components';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Edit, Trash2, RotateCcw } from 'lucide-react';

export default function Categories() {
  const { hasPermission } = useAuth();
  const { success, error } = useToast();
  const canWrite = hasPermission('category:write');

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort] = useState('name');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; category: any }>({ open: false, category: null });
  const [formDialog, setFormDialog] = useState<{ open: boolean; category: any }>({ open: false, category: null });
  const [formData, setFormData] = useState({ name: '', description: '', isActive: true });
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sort };
      if (search) params.search = search;
      if (statusFilter) params.isActive = statusFilter;
      const res = await categoryService.list(params);
      setCategories(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [page, limit, sort, search, statusFilter]);

  const openFormDialog = (category?: any) => {
    if (category) {
      setFormData({ name: category.name, description: category.description || '', isActive: category.isActive });
      setFormDialog({ open: true, category });
    } else {
      setFormData({ name: '', description: '', isActive: true });
      setFormDialog({ open: true, category: null });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (formDialog.category) {
        await categoryService.update(formDialog.category.id, formData);
        success('Category updated');
      } else {
        await categoryService.create(formData);
        success('Category created');
      }
      setFormDialog({ open: false, category: null });
      fetchCategories();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (category: any) => {
    setDeleteDialog({ open: true, category });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.category) return;
    try {
      await categoryService.delete(deleteDialog.category.id);
      success('Category deactivated');
      setDeleteDialog({ open: false, category: null });
      fetchCategories();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to deactivate category');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await categoryService.reactivate(id);
      success('Category reactivated');
      fetchCategories();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to reactivate category');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500">Manage product categories</p>
        </div>
        {canWrite && (
          <Button onClick={() => openFormDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchCategories()}
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
        </div>
      </div>

      {/* Categories Table */}
      <div className="card">
        <Table
          data={categories}
          columns={[
            { key: 'name', header: 'Name', render: (item: any) => <span className="font-medium">{item.name}</span> },
            { key: 'description', header: 'Description', render: (item: any) => item.description || <span className="text-gray-400">—</span> },
            { key: 'productCount', header: 'Products', className: 'text-right' },
            { key: 'isActive', header: 'Status', render: (item: any) => (
              <Badge variant={item.isActive ? 'success' : 'gray'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )},
            { key: 'createdAt', header: 'Created', render: (item: any) => new Date(item.createdAt).toLocaleDateString() },
            { key: 'actions', header: 'Actions', render: (item: any) => (
              <div className="flex items-center gap-2">
                {canWrite && (
                  <>
                    <button
                      onClick={() => openFormDialog(item)}
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
                  </>
                )}
              </div>
            ), className: 'w-32' },
          ]}
          keyExtractor={(item: any) => item.id}
          loading={loading}
          emptyMessage="No categories found"
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
        onClose={() => setDeleteDialog({ open: false, category: null })}
        onConfirm={confirmDelete}
        title="Deactivate Category"
        message={`Are you sure you want to deactivate "${deleteDialog.category?.name}"? This category is used by {deleteDialog.category?.productCount} product(s). You must reassign or deactivate those products first.`}
        confirmText="Deactivate"
      />

      {/* Form Dialog */}
      <Modal
        isOpen={formDialog.open}
        onClose={() => setFormDialog({ open: false, category: null })}
        title={formDialog.category ? 'Edit Category' : 'New Category'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Category name"
            required
          />
          <div>
            <label className="label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional description"
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
            <Button variant="secondary" onClick={() => setFormDialog({ open: false, category: null })}>Cancel</Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!formData.name.trim()}>
              {formDialog.category ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}