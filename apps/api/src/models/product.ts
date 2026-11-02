import { Schema, model } from 'mongoose';
import { stockStatusOf } from '@smartstock/shared';
import { ref } from './common';

const productSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 150 },
  sku: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40 },
  barcode: { type: String, unique: true, sparse: true, trim: true, minlength: 4, maxlength: 48 },
  description: { type: String, trim: true, maxlength: 2000 },
  category: ref('Category', true),
  supplier: ref('Supplier'),
  purchasePrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, default: 0, min: 0 },
  minimumStock: { type: Number, default: 0, min: 0 },
  maximumStock: { type: Number, min: 0 },
  unit: { type: String, trim: true, minlength: 1, default: 'pcs' },
  image: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

productSchema.index({ category: 1 });
productSchema.index({ supplier: 1 });
productSchema.index({ name: 'text', sku: 'text', barcode: 'text' });

productSchema.virtual('stockStatus').get(function (this: { quantity: number; minimumStock: number }) {
  return stockStatusOf(this.quantity, this.minimumStock);
});

export const Product = model('Product', productSchema);
