import { Schema, model } from 'mongoose';
import { ORDER_STATUSES } from '@smartstock/shared';
import { ref, timestamps } from './common';

const orderSchema = new Schema({
  orderNumber: { type: String, unique: true, required: true },
  supplier: ref('Supplier', true),
  items: [{
    _id: false,
    product: ref('Product', true),
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, required: true },
  }],
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
  expectedDate: Date,
  notes: { type: String, trim: true, maxlength: 1000 },
  createdBy: ref('User', true),
  confirmedAt: Date,
  receivedAt: Date,
  receivedBy: ref('User'),
  cancelledAt: Date,
  cancelReason: { type: String, trim: true, maxlength: 300 },
}, timestamps);

orderSchema.index({ supplier: 1, createdAt: -1 });
orderSchema.index({ createdBy: 1, createdAt: -1 });

export const Order = model('Order', orderSchema);
