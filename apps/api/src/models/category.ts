import { Schema, model } from 'mongoose';
import { timestamps } from './common';

const categorySchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500 },
  isActive: { type: Boolean, default: true },
}, timestamps);

export const Category = model('Category', categorySchema);
