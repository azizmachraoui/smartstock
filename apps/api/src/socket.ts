import type { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from './config/env';
import { User } from './models';

export type SocketRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type EventEntity =
  | 'product'
  | 'stock'
  | 'stock-movement'
  | 'category'
  | 'supplier'
  | 'order'
  | 'notification'
  | 'user';

export interface DomainEvent {
  /** Unique id used by clients to de-duplicate socket deliveries. */
  eventId: string;
  /** ISO timestamp used by clients to ignore stale events. */
  at: string;
  entity: EventEntity;
  action: string;
  id?: string;
  actorId?: string;
  data?: Record<string, unknown>;
}

const ALL_ROLES: SocketRole[] = ['ADMIN', 'MANAGER', 'EMPLOYEE'];
const ORDER_ROLES: SocketRole[] = ['ADMIN', 'MANAGER'];

let io: Server | null = null;

const buildEvent = (
  entity: EventEntity,
  action: string,
  payload: { id?: string; actorId?: string; data?: Record<string, unknown> },
): DomainEvent => ({
  eventId: crypto.randomUUID(),
  at: new Date().toISOString(),
  entity,
  action,
  ...payload,
});

function emitToRoles(roles: SocketRole[], eventName: string, payload: DomainEvent) {
  if (!io) return;
  for (const role of roles) io.to(`role:${role}`).emit(eventName, payload);
}

function emitToUser(userId: string, eventName: string, payload: DomainEvent) {
  if (!io) return;
  io.to(`user:${userId}`).emit(eventName, payload);
}

const allowedOrigins = (env.CORS_ORIGIN || env.CLIENT_URL)
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

/** JWT-authenticated Socket.IO server. Rooms: role:<ROLE> and user:<id>. */
export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const clean = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(clean) || (env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(clean))) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(async (socket: Socket, next) => {
    try {
      const authToken = (socket.handshake.auth as { token?: string } | undefined)?.token;
      const header = socket.handshake.headers.authorization;
      const token = authToken || (typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined);
      if (!token) return next(new Error('AUTH_REQUIRED'));
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub?: string; tv?: number };
      if (!payload.sub) return next(new Error('AUTH_INVALID'));
      const user = await User.findById(payload.sub).select('+tokenVersion');
      if (!user || !user.isActive || user.tokenVersion !== payload.tv) return next(new Error('AUTH_INVALID'));
      socket.data.actor = { id: user.id, role: user.role as SocketRole };
      return next();
    } catch {
      return next(new Error('AUTH_INVALID'));
    }
  });

  io.on('connection', (socket) => {
    const actor = socket.data.actor as { id: string; role: SocketRole };
    socket.join(`user:${actor.id}`);
    socket.join(`role:${actor.role}`);
    socket.emit('socket:ready', { userId: actor.id, role: actor.role, at: new Date().toISOString() });
    socket.on('error', () => undefined);
  });

  return io;
}

export function closeSocket() {
  io?.close();
  io = null;
}

export const socketEvents = {
  productChanged: (action: string, id: string, actorId?: string, data?: Record<string, unknown>) =>
    emitToRoles(ALL_ROLES, 'product:changed', buildEvent('product', action, { id, actorId, data })),
  categoryChanged: (action: string, id: string, actorId?: string) =>
    emitToRoles(ALL_ROLES, 'category:changed', buildEvent('category', action, { id, actorId })),
  supplierChanged: (action: string, id: string, actorId?: string) =>
    emitToRoles(ALL_ROLES, 'supplier:changed', buildEvent('supplier', action, { id, actorId })),
  stockUpdated: (productId: string, data: Record<string, unknown>, actorId?: string) =>
    emitToRoles(ALL_ROLES, 'stock:updated', buildEvent('stock', 'updated', { id: productId, actorId, data })),
  movementCreated: (movementId: string, data: Record<string, unknown>, actorId?: string) =>
    emitToRoles(ALL_ROLES, 'stock-movement:created', buildEvent('stock-movement', 'created', { id: movementId, actorId, data })),
  productLowStock: (productId: string, data: Record<string, unknown>) =>
    emitToRoles(ORDER_ROLES, 'product:low-stock', buildEvent('product', 'low-stock', { id: productId, data })),
  productOutOfStock: (productId: string, data: Record<string, unknown>) =>
    emitToRoles(ORDER_ROLES, 'product:out-of-stock', buildEvent('product', 'out-of-stock', { id: productId, data })),
  orderCreated: (orderId: string, data: Record<string, unknown>, actorId?: string) =>
    emitToRoles(ORDER_ROLES, 'order:created', buildEvent('order', 'created', { id: orderId, actorId, data })),
  orderUpdated: (orderId: string, data: Record<string, unknown>, actorId?: string) =>
    emitToRoles(ORDER_ROLES, 'order:updated', buildEvent('order', 'updated', { id: orderId, actorId, data })),
  orderStatusChanged: (orderId: string, status: string, actorId?: string) =>
    emitToRoles(ORDER_ROLES, 'order:status-changed', buildEvent('order', 'status-changed', { id: orderId, actorId, data: { status } })),
  notificationNew: (userId: string, notification: Record<string, unknown>) =>
    emitToUser(userId, 'notification:new', buildEvent('notification', 'created', { id: String(notification.id ?? ''), data: notification })),
  notificationChanged: (userId: string, id: string, action: string) =>
    emitToUser(userId, 'notification:changed', buildEvent('notification', action, { id })),
  userChanged: (userId: string, action: string, actorId?: string) =>
    emitToRoles(['ADMIN'], 'user:changed', buildEvent('user', action, { id: userId, actorId })),
};
