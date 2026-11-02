import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type {
  AuthSession,
  Category,
  CategoryInput,
  CategoryParams,
  MessageResponse,
  Notification,
  NotificationParams,
  Order,
  OrderInput,
  OrderParams,
  Paginated,
  Product,
  ProductInput,
  ProductParams,
  ProductUpdateInput,
  StockAdjustInput,
  StockAlerts,
  StockInInput,
  StockMovement,
  StockMovementParams,
  StockResult,
  Supplier,
  SupplierInput,
  SupplierParams,
  TokenPair,
  User,
} from '../types';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const USER_KEY = 'user';

const RAW_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const API_BASE = RAW_BASE.startsWith('http') ? RAW_BASE : `${RAW_BASE}`;
export const API_ORIGIN = RAW_BASE.startsWith('http') ? new URL(RAW_BASE).origin : '';

/* ------------------------------------------------------------------ *
 * Session storage helpers
 * ------------------------------------------------------------------ */

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY);

export function setSession(session: AuthSession): void {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function setTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/** Resolves a backend-relative asset path (e.g. /uploads/…) for the browser. */
export function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${API_ORIGIN}${path}`;
}

/* ------------------------------------------------------------------ *
 * Axios client + transparent access-token refresh
 * ------------------------------------------------------------------ */

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<TokenPair> | null = null;

/** Single-flight refresh shared by every 401 response. */
export function refreshSession(): Promise<TokenPair> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.reject(new Error('No refresh token available'));
  if (!refreshPromise) {
    const pending = axios
      .post<TokenPair>(`${API_BASE}/auth/refresh`, { refreshToken }, { timeout: 15_000 })
      .then(({ data }) => {
        setTokens(data);
        window.dispatchEvent(
          new CustomEvent<string>('auth:token-refreshed', { detail: data.accessToken }),
        );
        return data;
      });
    refreshPromise = pending;
    void pending
      .catch(() => undefined)
      .finally(() => {
        if (refreshPromise === pending) refreshPromise = null;
      });
  }
  return refreshPromise;
}

const isAuthPath = (url?: string): boolean =>
  !url || /\/auth\/(login|register|refresh|forgot-password|reset-password)/.test(url);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    if (!original || status !== 401 || original._retry || isAuthPath(original.url)) {
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      await refreshSession();
      return api(original);
    } catch {
      clearSession();
      window.dispatchEvent(new Event('auth:expired'));
      return Promise.reject(error);
    }
  },
);

export function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}

/* ------------------------------------------------------------------ *
 * Typed helpers
 * ------------------------------------------------------------------ */

async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<T>(url, config);
  return data;
}

async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.post<T>(url, body, config);
  return data;
}

async function put<T>(url: string, body: unknown): Promise<T> {
  const { data } = await api.put<T>(url, body);
  return data;
}

async function patch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<T>(url, body);
  return data;
}

async function del<T>(url: string): Promise<T> {
  const { data } = await api.delete<T>(url);
  return data;
}

/* ------------------------------------------------------------------ *
 * Services
 * ------------------------------------------------------------------ */

export const authService = {
  login: (email: string, password: string) =>
    post<AuthSession>('/auth/login', { email, password }),
  register: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  }) => post<AuthSession>('/auth/register', payload),
  logout: () => post<MessageResponse>('/auth/logout'),
  me: () => get<User>('/auth/me'),
  forgotPassword: (email: string) => post<MessageResponse>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    post<MessageResponse>('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<MessageResponse>('/auth/change-password', { currentPassword, newPassword }),
  getUsers: () => get<User[]>('/auth/users'),
  updateUser: (id: string, payload: { role?: User['role']; isActive?: boolean }) =>
    patch<User>(`/auth/users/${id}`, payload),
};

export const productService = {
  list: (params?: ProductParams) => get<Paginated<Product>>('/products', { params }),
  get: (id: string) => get<Product>(`/products/${id}`),
  getByBarcode: (code: string) => get<Product>(`/products/barcode/${encodeURIComponent(code)}`),
  generateSku: (categoryId: string) =>
    get<{ sku: string }>('/products/generate-sku', { params: { category: categoryId } }),
  create: (input: ProductInput) => post<Product>('/products', input),
  update: (id: string, input: ProductUpdateInput) => put<Product>(`/products/${id}`, input),
  deactivate: (id: string) => del<MessageResponse>(`/products/${id}`),
  delete: (id: string) => del<MessageResponse>(`/products/${id}`),
  reactivate: (id: string) => post<Product>(`/products/${id}/reactivate`),
  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return post<Product>(`/products/${id}/image`, form);
  },
  deleteImage: (id: string) => del<Product>(`/products/${id}/image`),
};

export const categoryService = {
  list: (params?: CategoryParams) => get<Paginated<Category>>('/categories', { params }),
  get: (id: string) => get<Category>(`/categories/${id}`),
  create: (input: CategoryInput) => post<Category>('/categories', input),
  update: (id: string, input: Partial<CategoryInput>) => put<Category>(`/categories/${id}`, input),
  deactivate: (id: string) => del<MessageResponse>(`/categories/${id}`),
  delete: (id: string) => del<MessageResponse>(`/categories/${id}`),
  reactivate: (id: string) => post<Category>(`/categories/${id}/reactivate`),
};

export const supplierService = {
  list: (params?: SupplierParams) => get<Paginated<Supplier>>('/suppliers', { params }),
  get: (id: string) => get<Supplier>(`/suppliers/${id}`),
  orders: (id: string, params?: OrderParams) =>
    get<Paginated<Order>>(`/suppliers/${id}/orders`, { params }),
  create: (input: SupplierInput) => post<Supplier>('/suppliers', input),
  update: (id: string, input: Partial<SupplierInput>) => put<Supplier>(`/suppliers/${id}`, input),
  deactivate: (id: string) => del<MessageResponse>(`/suppliers/${id}`),
  delete: (id: string) => del<MessageResponse>(`/suppliers/${id}`),
  reactivate: (id: string) => post<Supplier>(`/suppliers/${id}/reactivate`),
};

export const stockService = {
  movements: (params?: StockMovementParams) =>
    get<Paginated<StockMovement>>('/stock/movements', { params }),
  stockIn: (input: StockInInput) => post<StockResult>('/stock/in', input),
  stockOut: (input: StockInInput) => post<StockResult>('/stock/out', input),
  adjust: (input: StockAdjustInput) => post<StockResult>('/stock/adjust', input),
  alerts: () => get<StockAlerts>('/stock/alerts'),
};

export const orderService = {
  list: (params?: OrderParams) => get<Paginated<Order>>('/orders', { params }),
  get: (id: string) => get<Order>(`/orders/${id}`),
  create: (input: OrderInput) => post<Order>('/orders', input),
  update: (id: string, input: Partial<OrderInput>) => put<Order>(`/orders/${id}`, input),
  confirm: (id: string) => post<Order>(`/orders/${id}/confirm`),
  cancel: (id: string, reason?: string) => post<Order>(`/orders/${id}/cancel`, { reason }),
  receive: (id: string) => post<Order>(`/orders/${id}/receive`),
};

export const notificationService = {
  list: (params?: NotificationParams) =>
    get<Paginated<Notification>>('/notifications', { params }),
  unreadCount: () => get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => patch<Notification>(`/notifications/${id}/read`),
  markAllRead: () => post<MessageResponse>('/notifications/read-all'),
};
