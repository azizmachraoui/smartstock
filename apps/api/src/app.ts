import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import mongoose from 'mongoose';
import { env } from './config/env';
import productRoutes from './modules/products/products.routes';
import categoryRoutes from './modules/categories/categories.routes';
import supplierRoutes from './modules/suppliers/suppliers.routes';
import orderRoutes from './modules/orders/orders.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import authRoutes from './modules/auth/auth.routes';
import stockRoutes from './modules/stock/stock.routes';
import settingRoutes from './modules/settings/settings.routes';
import reportRoutes from './modules/reports/reports.routes';
import { errorHandler } from './middleware';

export const app = express();

// Trust proxy for Render / Cloud hosting reverse proxies
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration driven by CORS_ORIGIN
const allowedOrigins = (env.CORS_ORIGIN || env.CLIENT_URL)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(cleanOrigin) || (env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(cleanOrigin))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: Origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

// Health check endpoint (verifies server and database connection)
app.get('/health', (_req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const status = isDbConnected ? 'ok' : 'degraded';
  res.status(isDbConnected ? 200 : 503).json({
    status,
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Strict rate limiters for auth
// skip() is evaluated at request time so NODE_ENV=test set before server start is respected
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

const standardAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', strictAuthLimiter);
app.use('/api/auth/register', strictAuthLimiter);
app.use('/api/auth/forgot-password', strictAuthLimiter);
app.use('/api/auth/reset-password', strictAuthLimiter);
app.use('/api/auth/change-password', strictAuthLimiter);
app.use('/api/auth', standardAuthLimiter, authRoutes);

app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/stock', stockRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.put('/api/settings', strictAuthLimiter);
app.use('/api/settings', standardAuthLimiter, settingRoutes);
app.use('/api/reports', standardAuthLimiter, reportRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);
