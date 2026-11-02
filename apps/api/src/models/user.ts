import { Schema, model } from 'mongoose';
import { ROLES } from '@smartstock/shared';
import { timestamps } from './common';

export const User = model('User', new Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'EMPLOYEE' },
  phone: String,
  avatar: String,
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0, select: false },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
}, timestamps));
