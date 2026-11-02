import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { orderService, productService, supplierService } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Select } from '../components';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';

const orderItemSchema = z.object({
  product: z.string().min(1, 'Product is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
});

const orderSchema = z.object({
  supplier: z.string().min(1, 'Supplier is required'),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  expectedDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

export default function OrderForm() {
  const navigate = useNavigate();
  const params = useParams();
  const { hasPermission } = useAuth();
  const { success, error } = useToast();
  const canWrite = hasPermission('order:write');
  const isEdit = !!params.id;

  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      supplier: '',
      items: [{ product: '', quantity: 1, unitPrice: 0 }],
      expectedDate: '',
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [prodsRes, supsRes] = await Promise.all([
          productService.list({ isActive: true, limit: 1000 }),
          supplierService.list({ isActive: true, limit: 100 }),
        ]);
        setProducts(prodsRes.data || []);
        setSuppliers(supsRes.data || []);

        if (isEdit) {
          const order = (await orderService.get(params.id!)) as any;
          setValue('supplier', order.supplier?._id || order.supplier);
          setValue('expectedDate', order.expectedDate ? order.expectedDate.split('T')[0] : '');
          setValue('notes', order.notes || '');
          
          // Set items
          const items = order.items.map((item: any) => ({
            product: item.product?._id || item.product,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }));
          while (fields.length > 0) remove(0);
          items.forEach((item: any) => {
            append(item);
          });
        }
      } catch (err: any) {
        error(err.response?.data?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isEdit, params.id, setValue]);

  const getProductPrice = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.purchasePrice || 0;
  };

  const handleProductChange = (index: number, productId: string) => {
    const price = getProductPrice(productId);
    setValue(`items.${index}.unitPrice`, price, { shouldValidate: true });
  };

  const calculateTotal = () => {
    return watch('items').reduce((sum: number, item: any) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
  };

  const onSubmit = async (data: OrderFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        expectedDate: data.expectedDate || undefined,
        notes: data.notes || undefined,
      };
      if (isEdit) {
        await orderService.update(params.id!, payload);
        success('Order updated');
      } else {
        await orderService.create(payload);
        success('Order created');
      }
      navigate('/orders');
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to save order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!canWrite) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/orders')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Order' : 'New Purchase Order'}</h1>
          <p className="text-gray-500">{isEdit ? 'Update order details' : 'Create a new purchase order'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-6">
        {/* Supplier */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Supplier Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Supplier"
              error={errors.supplier?.message}
              options={[{ value: '', label: 'Select supplier' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
              {...register('supplier')}
            />
            <Input
              label="Expected Delivery Date"
              type="date"
              error={errors.expectedDate?.message}
              {...register('expectedDate')}
            />
            <div></div>
          </div>
        </div>

        {/* Order Items */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
            <button
              type="button"
              onClick={() => append({ product: '', quantity: 1, unitPrice: 0 })}
              className="btn-secondary text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-4 py-3 w-64">Product</th>
                  <th className="px-4 py-3 w-24">Quantity</th>
                  <th className="px-4 py-3 w-32">Unit Price</th>
                  <th className="px-4 py-3 w-32">Line Total</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fields.map((field, index) => (
                  <tr key={field.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Select
                        placeholder="Select product"
                        options={[{ value: '', label: 'Select product' }, ...products.map((p: any) => ({ value: p.id, label: `${p.name} (${p.sku}) - ${p.unit}` }))]}
                        value={watch(`items.${index}.product`)}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          handleProductChange(index, e.target.value);
                          setValue(`items.${index}.product`, e.target.value, { shouldValidate: true });
                        }}
                        error={errors.items?.[index]?.product?.message}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency((watch(`items.${index}.quantity`) || 0) * (watch(`items.${index}.unitPrice`) || 0))}
                    </td>
                    <td className="px-4 py-3">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-right font-semibold">Order Total:</td>
                  <td className="px-4 py-3 font-bold text-lg">{formatCurrency(calculateTotal())}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <div>
            <label className="label">Notes</label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional notes for the supplier"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={() => navigate('/orders')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!isValid || fields.length === 0}>
            {isEdit ? 'Update Order' : 'Create Order'}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { formatCurrency } from '../utils/format';