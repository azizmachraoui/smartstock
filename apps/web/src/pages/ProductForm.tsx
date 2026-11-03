import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ProductInput } from '../types';
import { categoryService, productService, supplierService } from '../services/api';
import { qk } from '../lib/queryKeys';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getFieldErrors, isForbidden, isNotFound } from '../lib/errors';
import { useDocumentTitle } from '../hooks/useData';
import { useRecordConflict } from '../context/SocketContext';
import { formatCurrency } from '../utils/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Fields';
import { ErrorState, PageLoading } from '../components/ui/States';
import { Badge } from '../components/ui/Badge';
import { ProductImage } from '../components/common/ProductImage';

const optionalInt = (message: string) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number({ invalid_type_error: message }).int(message).min(0, message).optional(),
  );

const baseSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(150, 'Use 150 characters or fewer'),
  sku: z.string().trim().max(40, 'Use 40 characters or fewer').optional(),
  barcode: z
    .string()
    .trim()
    .max(48, 'Use 48 characters or fewer')
    .optional()
    .refine((value) => !value || value.length >= 4, 'Use at least 4 characters'),
  description: z.string().max(2000, 'Use 2000 characters or fewer').optional(),
  category: z.string().min(1, 'Choose a category'),
  supplier: z.string().optional(),
  purchasePrice: z.preprocess(
    (value) => (value === '' || value === undefined ? NaN : Number(value)),
    z.number({ invalid_type_error: 'Enter a purchase price' }).min(0, 'Cannot be negative'),
  ),
  sellingPrice: z.preprocess(
    (value) => (value === '' || value === undefined ? NaN : Number(value)),
    z.number({ invalid_type_error: 'Enter a selling price' }).min(0, 'Cannot be negative'),
  ),
  quantity: optionalInt('Use a whole number of 0 or more'),
  minimumStock: optionalInt('Use a whole number of 0 or more'),
  maximumStock: optionalInt('Use a whole number of 0 or more'),
  unit: z.string().trim().min(1, 'Unit is required').max(20, 'Use 20 characters or fewer'),
});

const schema = baseSchema.refine(
  (values) =>
    values.maximumStock === undefined ||
    values.minimumStock === undefined ||
    values.maximumStock >= values.minimumStock,
  { message: 'Maximum stock must be at least the minimum', path: ['maximumStock'] },
);

type FormValues = z.infer<typeof schema>;

const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'roll', 'm', 'pair'];

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Edit product' : 'Add product');

  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasConflict, clearConflict } = useRecordConflict('product', id);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [skuLoading, setSkuLoading] = useState(false);

  const canWrite = hasPermission('product:write');

  const product = useQuery({
    queryKey: qk.product(id ?? 'new'),
    queryFn: () => productService.get(id as string),
    enabled: editing && canWrite,
  });

  const categories = useQuery({
    queryKey: qk.categories({ isActive: true, limit: 100 }),
    queryFn: () => categoryService.list({ isActive: true, limit: 100 }),
    staleTime: 120_000,
  });

  const suppliers = useQuery({
    queryKey: qk.suppliers({ isActive: true, limit: 100 }),
    queryFn: () => supplierService.list({ isActive: true, limit: 100 }),
    staleTime: 120_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      sku: '',
      barcode: '',
      description: '',
      category: '',
      supplier: '',
      purchasePrice: undefined as unknown as number,
      sellingPrice: undefined as unknown as number,
      quantity: 0,
      minimumStock: 0,
      maximumStock: undefined,
      unit: 'pcs',
    },
  });

  useEffect(() => {
    if (!product.data) return;
    const data = product.data;
    reset({
      name: data.name,
      sku: data.sku,
      barcode: data.barcode ?? '',
      description: data.description ?? '',
      category: typeof data.category === 'object' ? data.category.id : data.category,
      supplier: typeof data.supplier === 'object' ? data.supplier.id : (data.supplier ?? ''),
      purchasePrice: data.purchasePrice,
      sellingPrice: data.sellingPrice,
      quantity: data.quantity,
      minimumStock: data.minimumStock,
      maximumStock: data.maximumStock,
      unit: data.unit,
    });
  }, [product.data, reset]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const selectedCategory = watch('category');
  const purchasePrice = watch('purchasePrice');
  const sellingPrice = watch('sellingPrice');

  const margin = useMemo(() => {
    const cost = Number(purchasePrice);
    const price = Number(sellingPrice);
    if (!Number.isFinite(cost) || !Number.isFinite(price) || price <= 0) return null;
    return ((price - cost) / price) * 100;
  }, [purchasePrice, sellingPrice]);

  const generateSku = async () => {
    if (!selectedCategory) {
      setError('category', { message: 'Choose a category before generating a SKU' });
      return;
    }
    setSkuLoading(true);
    try {
      const { sku } = await productService.generateSku(selectedCategory);
      setValue('sku', sku, { shouldDirty: true, shouldValidate: true });
      toast.success('SKU generated from the category prefix');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSkuLoading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: ProductInput = {
        name: values.name,
        sku: values.sku?.trim() || undefined,
        barcode: values.barcode?.trim() || undefined,
        description: values.description?.trim() || undefined,
        category: values.category,
        supplier: values.supplier || undefined,
        purchasePrice: values.purchasePrice,
        sellingPrice: values.sellingPrice,
        quantity: values.quantity ?? 0,
        minimumStock: values.minimumStock ?? 0,
        maximumStock: values.maximumStock,
        unit: values.unit,
      };

      if (editing && id) {
        const { quantity: _qty, ...updatePayload } = payload;
        let saved = await productService.update(id, updatePayload);
        if (imageFile) saved = await productService.uploadImage(id, imageFile);
        else if (removeImage) saved = await productService.deleteImage(id);
        return saved;
      }

      let created = await productService.create(payload);
      if (imageFile) created = await productService.uploadImage(created.id, imageFile);
      return created;
    },
    onSuccess: (saved) => {
      toast.success(editing ? 'Product updated' : 'Product created');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['all-products'] });
      void queryClient.invalidateQueries({ queryKey: ['movements'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      clearConflict();
      navigate(`/products/${saved.id}`, { replace: true });
    },
    onError: (error) => {
      const fieldErrors = getFieldErrors(error);
      let matched = false;
      for (const [field, message] of Object.entries(fieldErrors)) {
        if (field in baseSchema.shape) {
          setError(field as keyof FormValues, { message });
          matched = true;
        }
      }
      if (!matched) setFormError(getErrorMessage(error));
      else setFormError(null);
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  if (!canWrite) {
    return (
      <Card>
        <ErrorState
          title="You cannot edit the catalog"
          message="Your role can view products but not create or change them."
        />
      </Card>
    );
  }

  if (editing && product.isLoading) return <PageLoading label="Loading product" />;

  if (editing && product.isError) {
    return (
      <Card>
        <ErrorState
          title={isNotFound(product.error) ? 'Product not found' : 'Could not load this product'}
          message={getErrorMessage(product.error)}
          onRetry={isForbidden(product.error) ? undefined : () => void product.refetch()}
        />
      </Card>
    );
  }

  const existing = product.data;
  const currentImage = removeImage ? undefined : existing?.image;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title={editing ? `Edit ${existing?.name ?? 'product'}` : 'Add a product'}
        description={
          editing
            ? 'Quantity is intentionally locked here — stock only changes through audited movements.'
            : 'Create the catalog record, then receive stock through a movement for a full audit trail.'
        }
        back={
          <Link
            to={editing && id ? `/products/${id}` : '/products'}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {editing ? 'Back to product' : 'Back to products'}
          </Link>
        }
      />

      {hasConflict ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Someone else changed this product while you were editing. Saving now overwrites their
              changes.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (product.data) {
                  const data = product.data;
                  reset({
                    name: data.name,
                    sku: data.sku,
                    barcode: data.barcode ?? '',
                    description: data.description ?? '',
                    category: typeof data.category === 'object' ? data.category.id : data.category,
                    supplier:
                      typeof data.supplier === 'object' ? data.supplier.id : (data.supplier ?? ''),
                    purchasePrice: data.purchasePrice,
                    sellingPrice: data.sellingPrice,
                    quantity: data.quantity,
                    minimumStock: data.minimumStock,
                    maximumStock: data.maximumStock,
                    unit: data.unit,
                  });
                }
                clearConflict();
                void product.refetch();
              }}
            >
              Reload latest
            </Button>
            <Button size="sm" variant="ghost" onClick={clearConflict}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader title="Product details" description="How this item is identified in the catalog." />
              <CardBody className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Product name"
                    placeholder="e.g. Arabica coffee beans"
                    required
                    error={errors.name?.message}
                    {...register('name')}
                  />
                </div>
                <Input
                  label="SKU"
                  placeholder="Auto-generated when left blank"
                  leftIcon={<Barcode className="h-4 w-4" aria-hidden="true" />}
                  error={errors.sku?.message}
                  hint="Unique stock keeping unit. Leave blank to generate one from the category."
                  rightSlot={
                    <Button
                      type="button"
                      variant="subtle"
                      size="sm"
                      className="!h-7 !px-2 !text-[11px]"
                      onClick={() => void generateSku()}
                      disabled={skuLoading}
                      title="Generate a SKU from the selected category"
                    >
                      {skuLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                      )}
                      Auto
                    </Button>
                  }
                  {...register('sku')}
                />
                <Input
                  label="Barcode"
                  placeholder="Scan or type a barcode"
                  leftIcon={<Barcode className="h-4 w-4" aria-hidden="true" />}
                  error={errors.barcode?.message}
                  {...register('barcode')}
                />
                <div className="sm:col-span-2">
                  <Textarea
                    label="Description"
                    placeholder="Optional notes about this product"
                    rows={3}
                    error={errors.description?.message}
                    {...register('description')}
                  />
                </div>
                <Select
                  label="Category"
                  required
                  placeholder="Select a category"
                  options={(categories.data?.data ?? []).map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  error={errors.category?.message}
                  hint={
                    categories.isError
                      ? 'Could not load categories. Go back and retry.'
                      : undefined
                  }
                  {...register('category')}
                />
                <Select
                  label="Supplier"
                  placeholder="No supplier"
                  options={(suppliers.data?.data ?? []).map((item) => ({
                    value: item.id,
                    label: item.company ? `${item.name} · ${item.company}` : item.name,
                  }))}
                  error={errors.supplier?.message}
                  {...register('supplier')}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Pricing"
                description="Purchase price drives inventory valuation; selling price drives retail value."
              />
              <CardBody className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Purchase price"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  required
                  leftIcon={<span className="text-xs font-semibold">$</span>}
                  error={errors.purchasePrice?.message}
                  {...register('purchasePrice')}
                />
                <Input
                  label="Selling price"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  required
                  leftIcon={<span className="text-xs font-semibold">$</span>}
                  error={errors.sellingPrice?.message}
                  hint={
                    margin === null
                      ? undefined
                      : `Margin ${margin.toFixed(1)}% · ${formatCurrency(Number(sellingPrice) - Number(purchasePrice))} per unit`
                  }
                  {...register('sellingPrice')}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Stock thresholds"
                description="Alerts trigger when on-hand quantity reaches the minimum."
              />
              <CardBody className="grid gap-5 sm:grid-cols-2">
                <Input
                  label={editing ? 'Current quantity (read only)' : 'Initial quantity'}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  disabled={editing}
                  hint={
                    editing
                      ? 'Use Stock in / Stock out or an adjustment to change quantity.'
                      : 'Recorded as an “Initial stock” movement on create.'
                  }
                  error={errors.quantity?.message}
                  {...register('quantity')}
                />
                <Input
                  label="Minimum stock"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  error={errors.minimumStock?.message}
                  {...register('minimumStock')}
                />
                <Input
                  label="Maximum stock (optional)"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  error={errors.maximumStock?.message}
                  {...register('maximumStock')}
                />
                <div>
                  <Input
                    label="Unit"
                    list="product-units"
                    error={errors.unit?.message}
                    {...register('unit')}
                  />
                  <datalist id="product-units">
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Product image" description="JPEG, PNG or WebP up to 2 MB." />
              <CardBody className="space-y-4">
                <div className="flex items-center gap-4">
                  {imagePreview || currentImage ? (
                    <img
                      src={imagePreview ?? undefined}
                      alt="Selected product"
                      className="h-20 w-20 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <ProductImage src={undefined} alt="" className="h-20 w-20" iconClassName="h-8 w-8" />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-navy-950 dark:text-slate-200 dark:hover:bg-slate-800">
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      {imageFile ? 'Change file' : 'Choose image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file && file.size > 2 * 1024 * 1024) {
                            toast.error('Images must be 2 MB or smaller');
                            return;
                          }
                          setImageFile(file);
                          setRemoveImage(false);
                        }}
                      />
                    </label>
                    {(imageFile || currentImage) && !removeImage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setImageFile(null);
                          setRemoveImage(true);
                        }}
                        leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                {removeImage ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    The current image will be deleted when you save.
                  </p>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Summary" />
              <CardBody className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Mode</span>
                  <Badge variant={editing ? 'info' : 'accent'}>{editing ? 'Editing' : 'New product'}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Supplier</span>
                  <span className="max-w-[10rem] truncate font-medium text-slate-700 dark:text-slate-200">
                    {suppliers.data?.data.find((item) => item.id === watch('supplier'))?.name ?? 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Category</span>
                  <span className="max-w-[10rem] truncate font-medium text-slate-700 dark:text-slate-200">
                    {categories.data?.data.find((item) => item.id === selectedCategory)?.name ?? '—'}
                  </span>
                </div>
                {editing ? (
                  <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <ImagePlus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Image changes upload immediately after the product saves.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          </div>
        </div>

        {formError ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(editing && id ? `/products/${id}` : '/products')}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isSubmitting || mutation.isPending}
            disabled={!isDirty && editing && !imageFile}
          >
            {editing ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
