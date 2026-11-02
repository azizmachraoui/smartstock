import { Schema, model } from 'mongoose';
import { createdOnly, ref } from './common';

const NOTIFICATION_TYPES = ['LOW_STOCK', 'OUT_OF_STOCK', 'ORDER_CREATED', 'ORDER_CONFIRMED', 'ORDER_RECEIVED', 'SYSTEM'] as const;

const notificationSchema = new Schema({
  user: ref('User', true),
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  title: { type: String, trim: true },
  message: { type: String, trim: true },
  isRead: { type: Boolean, default: false },
  relatedProduct: ref('Product'),
  resolved: { type: Boolean, default: false },
  resolvedAt: Date,
  dedupeKey: String,
}, createdOnly);

notificationSchema.index(
  { user: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $exists: true } } },
);
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

export const Notification = model('Notification', notificationSchema);
