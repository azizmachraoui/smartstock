import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, PackageCheck, XCircle } from 'lucide-react';
import type { Order } from '../../types';
import { orderService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/Modal';
import { Textarea } from '../ui/Fields';

export function OrderActions({ order }: { order: Order }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<'confirm' | 'receive' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canWrite = hasPermission('order:write');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['order'] });
    void queryClient.invalidateQueries({ queryKey: ['order-counts'] });
    void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    void queryClient.invalidateQueries({ queryKey: ['supplier'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const mutation = useMutation({
    mutationFn: async (action: 'confirm' | 'receive' | 'cancel') => {
      if (action === 'confirm') return orderService.confirm(order.id);
      if (action === 'receive') return orderService.receive(order.id);
      return orderService.cancel(order.id, reason.trim() || undefined);
    },
    onSuccess: (_data, action) => {
      toast.success(
        action === 'confirm'
          ? 'Order confirmed'
          : action === 'receive'
            ? 'Order received — stock updated'
            : 'Order cancelled',
      );
      invalidate();
      setDialog(null);
      setReason('');
      setError(null);
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError)),
  });

  if (!canWrite || !['PENDING', 'CONFIRMED'].includes(order.status)) return null;

  const openDialog = (next: 'confirm' | 'receive' | 'cancel') => {
    setError(null);
    setDialog(next);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {order.status === 'PENDING' ? (
          <Button
            size="sm"
            onClick={() => openDialog('confirm')}
            leftIcon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Confirm
          </Button>
        ) : null}
        {order.status === 'CONFIRMED' ? (
          <Button
            size="sm"
            onClick={() => openDialog('receive')}
            leftIcon={<PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Receive stock
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openDialog('cancel')}
          leftIcon={<XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Cancel
        </Button>
      </div>

      <ConfirmDialog
        open={dialog === 'confirm'}
        onClose={() => setDialog(null)}
        onConfirm={() => mutation.mutate('confirm')}
        title={`Confirm ${order.orderNumber}?`}
        description="Confirming tells the team the purchase is approved. Stock is not affected until the order is received."
        confirmLabel="Confirm order"
        tone="primary"
        loading={mutation.isPending}
      >
        {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'receive'}
        onClose={() => setDialog(null)}
        onConfirm={() => mutation.mutate('receive')}
        title={`Receive ${order.orderNumber}?`}
        description="This adds every line to stock in one transaction, writes stock movements and resolves any matching low-stock alerts. It cannot be undone."
        confirmLabel="Receive & update stock"
        tone="primary"
        loading={mutation.isPending}
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {order.items.length} line{order.items.length === 1 ? '' : 's'} will be added to stock.
          </p>
          {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => {
          setDialog(null);
          setReason('');
        }}
        onConfirm={() => mutation.mutate('cancel')}
        title={`Cancel ${order.orderNumber}?`}
        description="Cancelling is permanent. Stock is untouched because nothing has been received yet."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        tone="danger"
        loading={mutation.isPending}
      >
        <div className="space-y-3">
          <Textarea
            label="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Duplicate order, supplier issue, budget change…"
            maxLength={300}
            rows={3}
          />
          {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
