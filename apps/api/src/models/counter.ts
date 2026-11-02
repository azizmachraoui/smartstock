import { Schema, model } from 'mongoose';

/** Atomic sequence used for SKUs (`sku:<PREFIX>`) and purchase order numbers (`po:<YEAR>`). */
export const Counter = model('Counter', new Schema({
  _id: String,
  seq: { type: Number, default: 0 },
}));
