import { Schema, model } from 'mongoose';
import { MOVEMENT_TYPES } from '@smartstock/shared';
import { createdOnly, ref } from './common';

const movementSchema = new Schema({
  product: ref('Product', true),
  type: { type: String, enum: MOVEMENT_TYPES, required: true },
  quantity: { type: Number, required: true, min: 1 },
  previousQuantity: { type: Number, min: 0 },
  newQuantity: { type: Number, min: 0 },
  reason: { type: String, trim: true, maxlength: 200 },
  reference: { type: String, trim: true, maxlength: 100 },
  user: ref('User', true),
}, createdOnly);

movementSchema.index({ product: 1, createdAt: -1 });
movementSchema.index({ user: 1, createdAt: -1 });
movementSchema.index({ createdAt: -1 });

for (const hook of ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete', 'deleteOne', 'deleteMany', 'replaceOne'] as const) {
  movementSchema.pre(hook as any, function () {
    throw new Error('StockMovement records are immutable');
  });
}
movementSchema.pre('save', function () {
  if (!this.isNew) throw new Error('StockMovement records are immutable');
});

export const StockMovement = model('StockMovement', movementSchema);
