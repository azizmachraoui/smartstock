import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import type { MovementType, Product } from '../../types';
import { stockService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Fields';
import { Modal } from '../ui/Modal';
import { ProductSearch } from '../common/ProductSearch';

const typeMeta: Record<MovementType, { label: string; icon: React.ReactNode; hint: string }> = {
  IN: {
    label: 'Stock in',
    icon: <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />,
    hint: 'Add received units to the current on-hand quantity.',
  },
  OUT: {
    label: 'Stock out',
    icon: <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />,
    hint: 'Remove units for sales, damage, transfer or other usage.',
  },
  ADJUSTMENT: {
    label: 'Adjust',
    icon: <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />,
    hint: 'Set the counted quantity. A reason is required for the audit trail.',
  },
};

export function StockMovementModal({
  open,
  onClose,
  defaultProduct = null,
  defaultType = 'IN',
}: {
  open: boolean;
  onClose: () => void;
  defaultProduct?: Product | null;
  defaultType?: MovementType;
}) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState<MovementType>(defaultType);
  const [product, setProduct] = useState<Product | null>(defaultProduct);
  const [quantity, setQuantity] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setProduct(defaultProduct);
    setQuantity('');
    setNewQuantity(defaultProduct ? String(defaultProduct.quantity) : '');
    setReason('');
    setReference('');
    setError(null);
  }, [open, defaultType, defaultProduct]);

  const allowedTypes = useMemo(
    () => (['IN', 'OUT', 'ADJUSTMENT'] as MovementType[]).filter((value) => {
      if (value === 'ADJUSTMENT') return hasPermission('stock:adjust');
      return hasPermission('stock:write');
    }),
    [hasPermission],
  );

  useEffect(() => {
    if (!allowedTypes.includes(type) && allowedTypes.length > 0) setType(allowedTypes[0]);
  }, [allowedTypes, type]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error('Select a product first');
      if (type === 'ADJUSTMENT') {
        const counted = Number(newQuantity);
        if (!Number.isInteger(counted) || counted < 0) {
          throw new Error('Counted quantity must be a whole number of 0 or more');
        }
        if (reason.trim().length < 3) throw new Error('Add a reason of at least 3 characters');
        return stockService.adjust({
          product: product.id,
          newQuantity: counted,
          reason: reason.trim(),
          reference: reference.trim() || undefined,
        });
      }
      const units = Number(quantity);
      if (!Number.isInteger(units) || units <= 0) {
        throw new Error('Quantity must be a whole number greater than 0');
      }
      if (type === 'OUT' && units > product.quantity) {
        throw new Error(`Only ${product.quantity} ${product.unit} available for this product`);
      }
      return type === 'IN'
        ? stockService.stockIn({
            product: product.id,
            quantity: units,
            reason: reason.trim() || undefined,
            reference: reference.trim() || undefined,
          })
        : stockService.stockOut({
            product: product.id,
            quantity: units,
            reason: reason.trim() || undefined,
            reference: reference.trim() || undefined,
          });
    },
    onSuccess: (result) => {
      const warnings = result.warnings ?? [];
      toast.success(
        `${type === 'IN' ? 'Stock received' : type === 'OUT' ? 'Stock removed' : 'Stock adjusted'} · ${result.product.name}`,
      );
      for (const warning of warnings) toast(warning, { icon: '⚠️' });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product'] });
      void queryClient.invalidateQueries({ queryKey: ['movements'] });
      void queryClient.invalidateQueries({ queryKey: ['all-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['all-products'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      onClose();
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError)),
  });

  const projected = useMemo(() => {
    if (!product) return null;
    if (type === 'ADJUSTMENT') {
      const counted = Number(newQuantity);
      return Number.isFinite(counted) && newQuantity !== '' ? counted : null;
    }
    const units = Number(quantity);
    if (!Number.isFinite(units) || quantity === '') return null;
    return type === 'IN' ? product.quantity + units : product.quantity - units;
  }, [product, type, quantity, newQuantity]);

  const min = type === 'ADJUSTMENT' ? 0 : 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record stock movement"
      description="Movements are immutable and permanently recorded in the audit trail."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            loading={mutation.isPending}
            disabled={!product}
          >
            Record {typeMeta[type].label.toLowerCase()}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="field-label">Movement type</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {allowedTypes.map((value) => {
              const meta = typeMeta[value];
              const active = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setType(value);
                    setError(null);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500/30 dark:border-brand-400/60 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-navy-950 dark:text-slate-300'
                  }`}
                  aria-pressed={active}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{typeMeta[type].hint}</p>
        </div>

        <div>
          <span className="field-label">Product</span>
          <ProductSearch value={product} onSelect={setProduct} />
        </div>

        {product ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={type === 'ADJUSTMENT' ? 'Counted quantity' : 'Quantity'}
              type="number"
              min={min}
              step={1}
              inputMode="numeric"
              value={type === 'ADJUSTMENT' ? newQuantity : quantity}
              onChange={(event) =>
                type === 'ADJUSTMENT'
                  ? setNewQuantity(event.target.value)
                  : setQuantity(event.target.value)
              }
              hint={
                type === 'ADJUSTMENT'
                  ? `Physical count replaces the current ${product.quantity} ${product.unit}.`
                  : `Currently ${product.quantity} ${product.unit} on hand.`
              }
              required
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-navy-950/50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Projected on hand
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {projected === null ? '—' : `${projected} ${product.unit}`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {type === 'ADJUSTMENT'
                  ? 'New recorded quantity'
                  : type === 'IN'
                    ? 'After receiving'
                    : 'After removal'}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={type === 'ADJUSTMENT' ? 'Reason' : 'Reason (optional)'}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              type === 'IN'
                ? 'Delivery, return, initial stock…'
                : type === 'OUT'
                  ? 'Sale, damage, transfer…'
                  : 'Cycle count correction'
            }
            required={type === 'ADJUSTMENT'}
            maxLength={200}
          />
          <Input
            label="Reference (optional)"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="PO number, invoice, ticket…"
            maxLength={100}
          />
        </div>

        {type === 'OUT' && product && Number(quantity) > product.quantity ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            This exceeds the {product.quantity} {product.unit} currently on hand. The server will
            reject the movement.
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
