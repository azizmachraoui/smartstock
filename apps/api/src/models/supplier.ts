import { Schema, model } from 'mongoose';
import { timestamps } from './common';

const supplierSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true, maxlength: 300 },
  company: { type: String, trim: true, maxlength: 120 },
  taxNumber: { type: String, trim: true, maxlength: 40 },
  isActive: { type: Boolean, default: true },
}, timestamps);

supplierSchema.index({ name: 1 });

export const Supplier = model('Supplier', supplierSchema);
