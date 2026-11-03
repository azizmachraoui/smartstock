import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Select, Card, Badge } from '../components';
import { useAuth } from '../context/AuthContext';
import { authService, settingService } from '../services/api';
import { qk } from '../lib/queryKeys';
import { useToast } from '../hooks/useToast';
import {
  Save,
  Bell,
  Lock,
  Globe,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Info,
} from 'lucide-react';
import type { SettingsLanguage, SettingUpdateInput } from '@smartstock/shared';

export default function Settings() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  const isAdmin = user?.role === 'ADMIN';

  // ─── 1. General Application Settings Query ───────────────────────────────
  const {
    data: remoteSettings,
    isLoading,
    isError,
  } = useQuery({
    queryKey: qk.settings,
    queryFn: settingService.get,
    staleTime: 300_000,
  });

  const [formState, setFormState] = useState<SettingUpdateInput>({
    companyName: 'SmartStock Inc.',
    currency: 'USD',
    timezone: 'UTC',
    language: 'en',
    lowStockThreshold: 10,
    emailNotifications: true,
    orderNotifications: true,
    stockNotifications: true,
  });

  // Sync form when remote data loads
  useEffect(() => {
    if (remoteSettings) {
      setFormState({
        companyName: remoteSettings.companyName || 'SmartStock Inc.',
        currency: remoteSettings.currency || 'USD',
        timezone: remoteSettings.timezone || 'UTC',
        language: (remoteSettings.language as SettingsLanguage) || 'en',
        lowStockThreshold: remoteSettings.lowStockThreshold ?? 10,
        emailNotifications: remoteSettings.emailNotifications ?? true,
        orderNotifications: remoteSettings.orderNotifications ?? true,
        stockNotifications: remoteSettings.stockNotifications ?? true,
      });
    }
  }, [remoteSettings]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: (data: SettingUpdateInput) => settingService.update(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.settings, updated);
      queryClient.invalidateQueries({ queryKey: qk.settings });
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      success('Settings saved successfully');
    },
    onError: (err: any) => {
      error(err.response?.data?.message || 'Failed to save settings');
    },
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    saveMutation.mutate(formState);
  };

  // ─── 2. Change Password State & Handler ──────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdErrors, setPwdErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { current?: string; new?: string; confirm?: string } = {};

    if (!currentPassword) errors.current = 'Current password is required';
    if (!newPassword) {
      errors.new = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.new = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.new = 'Must include at least one uppercase letter';
    } else if (!/[a-z]/.test(newPassword)) {
      errors.new = 'Must include at least one lowercase letter';
    } else if (!/[0-9]/.test(newPassword)) {
      errors.new = 'Must include at least one number';
    } else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      errors.new = 'Must include at least one special character';
    }

    if (!confirmPassword) {
      errors.confirm = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      errors.confirm = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setPwdErrors(errors);
      return;
    }

    setPwdErrors({});
    setChangingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      success('Password changed successfully! Please sign in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Clean redirect to login page after short delay
      setTimeout(() => {
        logout();
      }, 1200);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Failed to load settings</h2>
        <p className="text-sm text-slate-500 mt-1">Please check your connection and refresh the page.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Application Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure system parameters, inventory thresholds, and account security
          </p>
        </div>
        {!isAdmin && (
          <Badge variant="warning" className="self-start sm:self-auto py-1 px-3">
            Read-Only (Admin Access Required to Modify)
          </Badge>
        )}
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            You are viewing settings in read-only mode. Only users with the <strong>ADMIN</strong> role can modify
            global company configuration and inventory thresholds.
          </span>
        </div>
      )}

      {/* ─── GENERAL SETTINGS ────────────────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">General Configuration</h2>
            <p className="text-xs text-slate-500">Business identity, currency and localization parameters</p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <Input
            label="Company Name"
            value={formState.companyName}
            disabled={!isAdmin}
            onChange={(e) => setFormState({ ...formState, companyName: e.target.value })}
            placeholder="e.g. SmartStock Logistics Ltd"
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Operating Currency"
              disabled={!isAdmin}
              options={[
                { value: 'USD', label: 'USD ($ - US Dollar)' },
                { value: 'EUR', label: 'EUR (€ - Euro)' },
                { value: 'GBP', label: 'GBP (£ - British Pound)' },
                { value: 'JPY', label: 'JPY (¥ - Japanese Yen)' },
                { value: 'CAD', label: 'CAD ($ - Canadian Dollar)' },
                { value: 'AUD', label: 'AUD ($ - Australian Dollar)' },
              ]}
              value={formState.currency}
              onChange={(e) => setFormState({ ...formState, currency: e.target.value })}
            />

            <Select
              label="System Timezone"
              disabled={!isAdmin}
              options={[
                { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
                { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
                { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
                { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
                { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
                { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
                { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
              ]}
              value={formState.timezone}
              onChange={(e) => setFormState({ ...formState, timezone: e.target.value })}
            />

            <Select
              label="Language"
              disabled={!isAdmin}
              options={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español (Spanish)' },
                { value: 'fr', label: 'Français (French)' },
                { value: 'de', label: 'Deutsch (German)' },
              ]}
              value={formState.language}
              onChange={(e) =>
                setFormState({ ...formState, language: e.target.value as SettingsLanguage })
              }
            />
          </div>

          {/* ─── INVENTORY & ALERTS ────────────────────────────────────────── */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Inventory Alerts & Thresholds
                </h3>
                <p className="text-xs text-slate-500">
                  Global fallback for low-stock triggers and real-time alerts
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Global Low-Stock Threshold"
                type="number"
                min="0"
                disabled={!isAdmin}
                value={formState.lowStockThreshold}
                onChange={(e) =>
                  setFormState({ ...formState, lowStockThreshold: Math.max(0, parseInt(e.target.value) || 0) })
                }
                hint="Used when a product has no specific minimum stock specified (> 0)."
              />

              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.stockNotifications}
                    onChange={(e) =>
                      setFormState({ ...formState, stockNotifications: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Enable Low-Stock and Out-of-Stock Notifications
                    </span>
                    <p className="text-xs text-slate-500">
                      Generate in-app notifications and real-time dashboard badges when stock drops below threshold.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.orderNotifications}
                    onChange={(e) =>
                      setFormState({ ...formState, orderNotifications: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Enable Purchase Order Lifecycle Notifications
                    </span>
                    <p className="text-xs text-slate-500">
                      Broadcast notifications when purchase orders are created, confirmed, received, or cancelled.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.emailNotifications}
                    onChange={(e) =>
                      setFormState({ ...formState, emailNotifications: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Email Dispatch Integration
                    </span>
                    <p className="text-xs text-slate-500">
                      Send transactional email alerts for critical inventory events via Resend.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-3">
              <Button type="submit" loading={saveMutation.isPending} leftIcon={<Save className="h-4 w-4" />}>
                Save Settings
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* ─── SECURITY & CHANGE PASSWORD ─────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change Account Password</h2>
            <p className="text-xs text-slate-500">
              Update your credentials. Changing your password revokes all active sessions on other devices.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            error={pwdErrors.current}
            required
          />

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            error={pwdErrors.new}
            hint="At least 8 chars with uppercase, lowercase, number, and special symbol."
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            error={pwdErrors.confirm}
            required
          />

          <Button type="submit" loading={changingPassword} leftIcon={<Lock className="h-4 w-4" />}>
            Update Password
          </Button>
        </form>
      </Card>

      {/* ─── SYSTEM SECURITY POLICIES & PLACEHOLDERS ─────────────────────── */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">System Security Policies</h2>
            <p className="text-xs text-slate-500">Security enforcement status</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Password Strength Policy</p>
              <p className="text-[11px] text-slate-500">
                Minimum 8 characters with lowercase, uppercase, numeric, and special characters enforced by backend Zod validation.
              </p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Two-Factor Authentication (2FA)</p>
              <p className="text-[11px] text-slate-500">
                Time-based One-Time Password (TOTP) authentication for staff logins.
              </p>
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              Not available yet
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 dark:border-rose-950/40 dark:bg-rose-950/20">
            <div>
              <p className="text-xs font-semibold text-rose-900 dark:text-rose-300">Danger Zone: Database Reset</p>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                Full database purge is blocked via the web UI for security and compliance.
              </p>
            </div>
            <span className="text-[11px] font-medium text-rose-500 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md">
              Disabled
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
