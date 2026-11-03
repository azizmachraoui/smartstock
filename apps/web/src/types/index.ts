import type { Permission as SharedPermission, Role as SharedRole } from '@smartstock/shared';

export type Role = SharedRole;
export type Permission = SharedPermission;
export type StockStatus = 'OK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED';
export type NotificationType =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_RECEIVED'
  | 'SYSTEM';

/* ------------------------------------------------------------------ *
 * Core entities (shapes mirror the live REST API serialization)
 * ------------------------------------------------------------------ */

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRef {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  taxNumber?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats?: SupplierStats;
}

export interface SupplierRef {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
}

export interface SupplierStats {
  productCount: number;
  orderCount: number;
  totalReceivedAmount: number;
  byStatus: Partial<Record<OrderStatus, { count: number; amount: number }>>;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  category: CategoryRef | string;
  supplier?: SupplierRef | string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minimumStock: number;
  maximumStock?: number;
  unit: string;
  image?: string;
  isActive: boolean;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
  recentMovements?: StockMovement[];
}

export interface ProductRef {
  id: string;
  name: string;
  sku?: string;
  unit?: string;
}

export interface StockMovement {
  id: string;
  product: ProductRef | string;
  type: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  reference?: string;
  user: UserSummary | string;
  createdAt: string;
}

export interface OrderItem {
  product: ProductRef | string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  supplier: SupplierRef | string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  expectedDate?: string;
  notes?: string;
  createdBy: UserSummary | string;
  confirmedAt?: string;
  receivedAt?: string;
  receivedBy?: UserSummary | string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  user?: string;
  type: NotificationType;
  title?: string;
  message?: string;
  isRead: boolean;
  relatedProduct?: ProductRef | string;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * Responses & request payloads
 * ------------------------------------------------------------------ */

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface StockAlerts {
  summary: { total: number; outOfStock: number; lowStock: number };
  data: Product[];
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface MessageResponse {
  message: string;
}

export interface StockResult {
  movement: StockMovement;
  product: Product;
  warnings: string[];
}

export interface DashboardOrderCounts {
  PENDING: number;
  CONFIRMED: number;
  RECEIVED: number;
  CANCELLED: number;
  total: number;
}

export interface ProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category: string;
  supplier?: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minimumStock: number;
  maximumStock?: number;
  unit: string;
  isActive?: boolean;
}

export type ProductUpdateInput = Partial<Omit<ProductInput, 'quantity'>>;

export interface CategoryInput {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface SupplierInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  taxNumber?: string;
  isActive?: boolean;
}

export interface StockInInput {
  product: string;
  quantity: number;
  reason?: string;
  reference?: string;
}

export interface StockAdjustInput {
  product: string;
  newQuantity: number;
  reason: string;
  reference?: string;
}

export interface OrderInput {
  supplier: string;
  items: { product: string; quantity: number; unitPrice?: number }[];
  expectedDate?: string;
  notes?: string;
}

/* ------------------------------------------------------------------ *
 * Query parameters
 * ------------------------------------------------------------------ */

export interface PageParams {
  page?: number;
  limit?: number;
}

export interface ProductParams extends PageParams {
  search?: string;
  category?: string;
  supplier?: string;
  isActive?: boolean;
  lowStock?: boolean;
  outOfStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export interface CategoryParams extends PageParams {
  search?: string;
  isActive?: boolean;
  sort?: string;
}

export interface SupplierParams extends PageParams {
  search?: string;
  isActive?: boolean;
  company?: string;
  hasEmail?: boolean;
  sort?: string;
}

export interface StockMovementParams extends PageParams {
  product?: string;
  type?: MovementType;
  user?: string;
  reference?: string;
  from?: string;
  to?: string;
}

export interface OrderParams extends PageParams {
  status?: OrderStatus;
  supplier?: string;
  search?: string;
  from?: string;
  to?: string;
  sort?: string;
}

export interface NotificationParams extends PageParams {
  isRead?: boolean;
  resolved?: boolean;
  type?: NotificationType;
}

/* ------------------------------------------------------------------ *
 * Socket events
 * ------------------------------------------------------------------ */

export type SocketEntity =
  | 'product'
  | 'stock'
  | 'stock-movement'
  | 'category'
  | 'supplier'
  | 'order'
  | 'notification'
  | 'user';

export interface DomainEvent {
  eventId: string;
  at: string;
  entity: SocketEntity;
  action: string;
  id?: string;
  actorId?: string;
  data?: Record<string, unknown>;
}

export interface SocketReadyEvent {
  userId: string;
  role: Role;
  at: string;
}

export interface ServerToClientEvents {
  'socket:ready': (payload: SocketReadyEvent) => void;
  'product:changed': (event: DomainEvent) => void;
  'category:changed': (event: DomainEvent) => void;
  'supplier:changed': (event: DomainEvent) => void;
  'stock:updated': (event: DomainEvent) => void;
  'stock-movement:created': (event: DomainEvent) => void;
  'product:low-stock': (event: DomainEvent) => void;
  'product:out-of-stock': (event: DomainEvent) => void;
  'order:created': (event: DomainEvent) => void;
  'order:updated': (event: DomainEvent) => void;
  'order:status-changed': (event: DomainEvent) => void;
  'notification:new': (event: DomainEvent) => void;
  'notification:changed': (event: DomainEvent) => void;
  'user:changed': (event: DomainEvent) => void;
}

export type { SettingData, SettingUpdateInput } from '@smartstock/shared';

