import { Schema } from 'mongoose';

/** Shared schema options so every collection exposes the same timestamps. */
export const timestamps = { timestamps: true } as const;
export const createdOnly = { timestamps: { createdAt: true, updatedAt: false } } as const;

export const ref = (model: string, required = false) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required,
});
