import mongoose, { Schema, Document } from 'mongoose';
import { SETTINGS_LANGUAGES } from '@smartstock/shared';

export interface ISetting extends Document {
  key: string;
  companyName: string;
  currency: string;
  timezone: string;
  language: string;
  lowStockThreshold: number;
  emailNotifications: boolean;
  orderNotifications: boolean;
  stockNotifications: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, default: 'app_settings', unique: true, index: true },
    companyName: { type: String, required: true, trim: true, default: 'SmartStock Inc.' },
    currency: { type: String, required: true, uppercase: true, trim: true, default: 'USD' },
    timezone: { type: String, required: true, trim: true, default: 'UTC' },
    language: { type: String, required: true, trim: true, default: 'en', enum: SETTINGS_LANGUAGES },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 10 },
    emailNotifications: { type: Boolean, default: true },
    orderNotifications: { type: Boolean, default: true },
    stockNotifications: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

settingSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Setting = mongoose.model<ISetting>('Setting', settingSchema);
