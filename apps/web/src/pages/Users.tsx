import React, { useEffect, useState } from 'react';
import { authService } from '../services/api';
import { formatDateTime } from '../utils/format';
import { Table, Badge, Button, Modal, Input } from '../components';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { Edit, Shield, UserX, UserCheck, Key } from 'lucide-react';
import type { Role } from '../types';

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
];

const roleColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  ADMIN: 'danger',
  MANAGER: 'warning',
  EMPLOYEE: 'info',
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [editForm, setEditForm] = useState({ role: '', isActive: true });
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authService.getUsers();
      setUsers(res || []);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openEditDialog = (user: any) => {
    setEditForm({ role: user.role, isActive: user.isActive });
    setEditDialog({ open: true, user });
  };

  const handleEditSubmit = async () => {
    if (!editDialog.user) return;
    setSubmitting(true);
    try {
      await authService.updateUser(editDialog.user.id, {
        role: editForm.role as Role,
        isActive: editForm.isActive,
      });
      success('User updated');
      setEditDialog({ open: false, user: null });
      fetchUsers();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const openResetPasswordDialog = (user: any) => {
    setResetPasswordForm({ password: '', confirmPassword: '' });
    setResetPasswordDialog({ open: true, user });
  };

  const handleResetPassword = async () => {
    if (!resetPasswordDialog.user) return;
    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      error('Passwords do not match');
      return;
    }
    if (resetPasswordForm.password.length < 8) {
      error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      // Use the change-password endpoint as admin would need to implement a separate endpoint
      // For now, we'll show a message that this needs backend implementation
      success('Password reset functionality requires backend endpoint implementation');
      setResetPasswordDialog({ open: false, user: null });
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = (user: any) => {
    setDeleteDialog({ open: true, user });
  };

  const confirmDeactivate = async () => {
    if (!deleteDialog.user) return;
    setSubmitting(true);
    try {
      await authService.updateUser(deleteDialog.user.id, { isActive: false });
      success('User deactivated');
      setDeleteDialog({ open: false, user: null });
      fetchUsers();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to deactivate user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await authService.updateUser(id, { isActive: true });
      success('User reactivated');
      fetchUsers();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to reactivate user');
    }
  };

  // Check if current user is the last admin
  const isLastAdmin = (user: any) => {
    if (user.role !== 'ADMIN' || user.id === currentUser?.id) return false;
    const adminCount = users.filter(u => u.role === 'ADMIN' && u.isActive).length;
    return adminCount <= 1;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage system users and permissions</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <Table
          data={users}
          columns={[
            { key: 'name', header: 'User', render: (item: any) => (
              <div>
                <p className="font-medium">{item.firstName} {item.lastName}</p>
                <p className="text-sm text-gray-500">{item.email}</p>
              </div>
            )},
            { key: 'role', header: 'Role', render: (item: any) => (
              <Badge variant={roleColors[item.role] || 'gray'}>
                <Shield className="w-3 h-3 mr-1" />
                {item.role}
              </Badge>
            )},
            { key: 'phone', header: 'Phone', render: (item: any) => item.phone || <span className="text-gray-400">—</span> },
            { key: 'isActive', header: 'Status', render: (item: any) => (
              <Badge variant={item.isActive ? 'success' : 'gray'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )},
            { key: 'createdAt', header: 'Created', render: (item: any) => formatDateTime(item.createdAt) },
            { key: 'actions', header: 'Actions', render: (item: any) => (
              <div className="flex items-center gap-1">
                {item.id !== currentUser?.id && (
                  <>
                    <button
                      onClick={() => openEditDialog(item)}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      title="Edit Role/Status"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openResetPasswordDialog(item)}
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    {item.isActive ? (
                      !isLastAdmin(item) && (
                        <button
                          onClick={() => handleDeactivate(item)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="Deactivate"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleReactivate(item.id)}
                        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                        title="Reactivate"
                      >
                        <UserCheck className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ), className: 'w-40' },
          ]}
          keyExtractor={(item: any) => item.id}
          loading={loading}
          emptyMessage="No users found"
        />
      </div>

      {/* Edit Dialog */}
      <Modal
        isOpen={editDialog.open}
        onClose={() => setEditDialog({ open: false, user: null })}
        title="Edit User"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Editing: <strong>{editDialog.user?.firstName} {editDialog.user?.lastName}</strong> ({editDialog.user?.email})</p>
          <select
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={editForm.isActive}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setEditDialog({ open: false, user: null })}>Cancel</Button>
            <Button onClick={handleEditSubmit} loading={submitting}>Update</Button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Dialog */}
      <Modal
        isOpen={resetPasswordDialog.open}
        onClose={() => setResetPasswordDialog({ open: false, user: null })}
        title="Reset Password"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Resetting password for: <strong>{resetPasswordDialog.user?.firstName} {resetPasswordDialog.user?.lastName}</strong></p>
          <Input
            label="New Password"
            type="password"
            value={resetPasswordForm.password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetPasswordForm({ ...resetPasswordForm, password: e.target.value })}
            placeholder="Enter new password (min 8 chars)"
            minLength={8}
            required
          />
          <Input
            label="Confirm Password"
            type="password"
            value={resetPasswordForm.confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
            placeholder="Confirm new password"
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setResetPasswordDialog({ open: false, user: null })}>Cancel</Button>
            <Button onClick={handleResetPassword} loading={submitting}>Reset Password</Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        onConfirm={confirmDeactivate}
        title="Deactivate User"
        message={`Are you sure you want to deactivate "${deleteDialog.user?.firstName} ${deleteDialog.user?.lastName}"? They will no longer be able to log in.`}
        confirmText="Deactivate"
        variant="danger"
      />
    </div>
  );
}