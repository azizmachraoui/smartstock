import { z } from 'zod';
export const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];
export const MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT'] as const;
export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'RECEIVED', 'CANCELLED'] as const;

export type Permission =
  | 'product:read' | 'product:write' | 'category:read' | 'category:write'
  | 'supplier:read' | 'supplier:write' | 'stock:read' | 'stock:write' | 'stock:adjust'
  | 'order:read' | 'order:write' | 'analytics:read' | 'user:manage' | 'settings:manage';

const employee: Permission[] = ['product:read', 'category:read', 'supplier:read', 'stock:read', 'stock:write'];
const manager: Permission[] = [...employee, 'stock:adjust', 'product:write', 'category:write', 'supplier:write', 'order:read', 'order:write', 'analytics:read'];
export const PERMISSIONS: Record<Role, Permission[] | '*'> = { ADMIN: '*', MANAGER: manager, EMPLOYEE: employee };
export const hasPermission = (role: Role, p: Permission) => PERMISSIONS[role] === '*' || (PERMISSIONS[role] as Permission[]).includes(p);

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

const password = passwordSchema;

export const registerSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name is too long (max 50)'),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name is too long (max 50)'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: passwordSchema,
  phone: z.string().trim().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

export const forgotSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
});

export const resetSchema = z.object({
  token: z
    .string({ required_error: 'Token is required' })
    .trim()
    .min(10, 'Reset token is invalid or too short'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ required_error: 'Current password is required' })
    .min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .trim()
    .min(10, 'Invalid refresh token'),
});

const optStr = (label: string, max: number) => z.string().trim().max(max, `${label} is too long (max ${max})`).optional();
export const categorySchema = z.object({
  name: z.string({ required_error: 'Category name is required' }).trim().min(2, 'Category name must be at least 2 characters').max(80, 'Category name is too long (max 80)'),
  description: optStr('Description', 500), isActive: z.boolean().optional(),
});
export const categoryUpdateSchema = categorySchema.partial();
export const supplierSchema = z.object({
  name: z.string({ required_error: 'Supplier name is required' }).trim().min(2, 'Supplier name must be at least 2 characters').max(120, 'Supplier name is too long (max 120)'),
  email: z.string().trim().email('Invalid email address').optional(),
  phone: z.string().trim().regex(/^[+\d][\d\s().-]{5,19}$/, 'Invalid phone number').optional(),
  address: optStr('Address', 300), company: optStr('Company', 120), taxNumber: optStr('Tax number', 40), isActive: z.boolean().optional(),
});
export const supplierUpdateSchema = supplierSchema.partial();
const objectId = (label: string) => z.string({ required_error: `${label} is required` }).regex(/^[a-f\d]{24}$/i, `${label} is not a valid id`);
const money = (label: string) => z.number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` }).min(0, `${label} cannot be negative`);
const stockInt = (label: string) => z.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be a whole number`).min(0, `${label} cannot be negative`);
export const productBase = z.object({
  name: z.string({ required_error: 'Product name is required' }).trim().min(1, 'Product name is required').max(150, 'Product name is too long (max 150)'),
  sku: z.string().trim().min(1, 'SKU cannot be empty').max(40).optional(), // generated server-side when omitted
  barcode: z.string().trim().min(4, 'Barcode must be at least 4 characters').max(48).optional(),
  description: z.string().max(2000, 'Description is too long (max 2000)').optional(),
  category: objectId('Category'), supplier: objectId('Supplier').optional(),
  purchasePrice: money('Purchase price'), sellingPrice: money('Selling price'),
  quantity: stockInt('Quantity').default(0), minimumStock: stockInt('Minimum stock').default(0), maximumStock: stockInt('Maximum stock').optional(),
  unit: z.string().trim().min(1).default('pcs'), isActive: z.boolean().optional(),
});
const stockRule = (p: any) => p.maximumStock === undefined || p.minimumStock === undefined || p.maximumStock >= p.minimumStock;
export const productSchema = productBase.refine(stockRule, { message: 'Maximum stock must be >= minimum stock', path: ['maximumStock'] });
// Quantity is intentionally not editable here: it only changes through stock movements (audit trail).
export const productUpdateSchema = productBase.omit({ quantity: true }).partial().refine(stockRule, { message: 'Maximum stock must be >= minimum stock', path: ['maximumStock'] });
const qty = z.number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' }).int('Quantity must be a whole number').positive('Quantity must be greater than 0');
const ref = z.string().trim().max(100, 'Reference is too long (max 100)').optional();
const reason = z.string().trim().max(200, 'Reason is too long (max 200)').optional();
export const stockInSchema = z.object({ product: objectId('Product'), quantity: qty, reason, reference: ref });
export const stockOutSchema = stockInSchema;
// Adjustment = "the real counted quantity is X". Reason is mandatory for traceability.
export const stockAdjustSchema = z.object({
  product: objectId('Product'),
  newQuantity: z.number({ required_error: 'New quantity is required', invalid_type_error: 'New quantity must be a number' }).int('New quantity must be a whole number').min(0, 'New quantity cannot be negative'),
  reason: z.string({ required_error: 'A reason is required for adjustments' }).trim().min(3, 'A reason is required for adjustments (min 3 characters)').max(200, 'Reason is too long (max 200)'),
  reference: ref,
});

export type StockStatus = 'OK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export const stockStatusOf = (quantity: number, minimumStock: number): StockStatus => (quantity <= 0 ? 'OUT_OF_STOCK' : quantity <= minimumStock ? 'LOW_STOCK' : 'OK');
export const NOTIFICATION_TYPES = ['LOW_STOCK', 'OUT_OF_STOCK', 'ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_RECEIVED', 'SYSTEM'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const orderItem = z.object({
  product: objectId('Product'),
  quantity: z.number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' }).int('Quantity must be a whole number').positive('Quantity must be greater than 0'),
  unitPrice: z.number({ invalid_type_error: 'Unit price must be a number' }).min(0, 'Unit price cannot be negative').optional(), // defaults to product purchase price
});
const notPast = (d: Date) => d.getTime() >= new Date().setHours(0, 0, 0, 0);
export const orderSchema = z.object({
  supplier: objectId('Supplier'),
  items: z.array(orderItem, { required_error: 'An order needs at least one product' }).min(1, 'An order needs at least one product').max(100, 'Too many lines (max 100)'),
  expectedDate: z.coerce.date({ invalid_type_error: 'Expected date is not a valid date' }).refine(notPast, 'Expected date cannot be in the past').optional(),
  notes: z.string().trim().max(1000, 'Notes are too long (max 1000)').optional(),
});
export const orderUpdateSchema = orderSchema.partial();
export const orderCancelSchema = z.object({ reason: z.string().trim().max(300, 'Reason is too long (max 300)').optional() });

export const SETTINGS_LANGUAGES = ['en', 'es', 'fr', 'de'] as const;
export type SettingsLanguage = (typeof SETTINGS_LANGUAGES)[number];

export const settingUpdateSchema = z.object({
  companyName: z
    .string({ required_error: 'Company name is required' })
    .trim()
    .min(1, 'Company name is required')
    .max(100, 'Company name is too long (max 100)'),
  currency: z
    .string({ required_error: 'Currency is required' })
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .toUpperCase(),
  timezone: z
    .string({ required_error: 'Timezone is required' })
    .trim()
    .min(1, 'Timezone is required')
    .max(80, 'Timezone is too long (max 80)'),
  language: z.enum(SETTINGS_LANGUAGES, {
    errorMap: () => ({ message: 'Language must be one of: en, es, fr, de' }),
  }),
  lowStockThreshold: z
    .number({ required_error: 'Low stock threshold is required' })
    .int('Threshold must be a whole number')
    .min(0, 'Threshold cannot be negative'),
  emailNotifications: z.boolean().default(true),
  orderNotifications: z.boolean().default(true),
  stockNotifications: z.boolean().default(true),
}).strict();

export type SettingUpdateInput = z.infer<typeof settingUpdateSchema>;

export interface SettingData extends SettingUpdateInput {
  id: string;
  key: string;
  updatedBy?: string | { id: string; firstName: string; lastName: string; email: string };
  createdAt: string;
  updatedAt: string;
}

