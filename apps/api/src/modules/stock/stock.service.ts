import mongoose, { ClientSession } from 'mongoose';
import { Product, StockMovement } from '../../models';
import { AppError } from '../../utils/errors';

export type MovementInput = { product: string; type: 'IN' | 'OUT' | 'ADJUSTMENT'; quantity: number; reason?: string; reference?: string; userId: string };

/** Runs fn in a MongoDB transaction if replica set is available, otherwise runs without transaction. */
export async function inTransaction<T>(fn: (s: ClientSession) => Promise<T>): Promise<T> {
  try {
    const session = await mongoose.startSession();
    try {
      let out!: T;
      await session.withTransaction(async () => { out = await fn(session); });
      return out;
    } finally {
      await session.endSession();
    }
  } catch (err: any) {
    // Fallback to non-transactional execution if transactions are not supported (standalone MongoDB)
    if (err.codeName === 'IllegalOperation' || err.errmsg?.includes('Transaction numbers are only allowed')) {
      console.warn('Transactions not supported (standalone MongoDB), running without transaction');
      return fn(null as any);
    }
    throw err;
  }
}

/**
 * The ONLY place that changes Product.quantity.
 * Product update + StockMovement insert happen in the caller's transaction: both commit or neither does.
 * For ADJUSTMENT, `quantity` is the new counted quantity; the stored movement quantity is the absolute difference.
 */
export async function applyMovement(i: MovementInput, session: ClientSession | null) {
  const base = { _id: i.product, isActive: true };
  const sessionOpts = session ? { session } : {};
  let before: any;
  if (i.type === 'IN') before = await Product.findOneAndUpdate(base, { $inc: { quantity: i.quantity } }, { new: false, ...sessionOpts });
  else if (i.type === 'OUT') before = await Product.findOneAndUpdate({ ...base, quantity: { $gte: i.quantity } }, { $inc: { quantity: -i.quantity } }, { new: false, ...sessionOpts });
  else {
    const cur = session ? await Product.findOne(base).session(session) : await Product.findOne(base);
    if (!cur) throw new AppError(404, 'Product not found or inactive');
    if (cur.quantity === i.quantity) throw new AppError(400, `Stock is already ${cur.quantity}; nothing to adjust`);
    before = await Product.findOneAndUpdate({ ...base, quantity: cur.quantity }, { quantity: i.quantity }, { new: false, ...sessionOpts });
    if (!before) throw new AppError(409, 'Stock changed while adjusting, please retry');
  }
  if (!before) {
    const p = session ? await Product.findById(i.product).session(session) : await Product.findById(i.product);
    if (!p || !p.isActive) throw new AppError(404, 'Product not found or inactive');
    throw new AppError(409, `Insufficient stock for ${p.name}: ${p.quantity} ${p.unit} available, ${i.quantity} requested`);
  }
  const previousQuantity: number = before.quantity;
  const newQuantity = i.type === 'IN' ? previousQuantity + i.quantity : i.type === 'OUT' ? previousQuantity - i.quantity : i.quantity;
  const [movement] = await StockMovement.create([{
    product: i.product, type: i.type, quantity: i.type === 'ADJUSTMENT' ? Math.abs(newQuantity - previousQuantity) : i.quantity,
    previousQuantity, newQuantity, reason: i.reason, reference: i.reference, user: i.userId,
  }], sessionOpts);
  const warnings: string[] = [];
  if (before.maximumStock && newQuantity > before.maximumStock) warnings.push(`Stock (${newQuantity}) exceeds the maximum of ${before.maximumStock}`);
  return { movement, product: { id: before.id, name: before.name, sku: before.sku, unit: before.unit, minimumStock: before.minimumStock, quantity: newQuantity }, warnings };
}
