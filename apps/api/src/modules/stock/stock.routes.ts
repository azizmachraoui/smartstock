import { Router } from 'express';
import { stockInSchema, stockOutSchema, stockAdjustSchema } from '@smartstock/shared';
import { Product, StockMovement } from '../../models';
import { authenticate, can, validate } from '../../middleware';
import { AppError, asyncH } from '../../utils/errors';
import { paging } from '../../utils/query';
import { applyMovement, inTransaction } from './stock.service';
import { syncStockAlert } from '../alerts/alerts.service';
import { socketEvents } from '../../socket';

const r = Router(); r.use(authenticate);

const record = (type: 'IN' | 'OUT' | 'ADJUSTMENT') => asyncH(async (req: any, res: any) => {
  const b = req.body;
  const out = await inTransaction((s) => applyMovement({ product: b.product, type, quantity: type === 'ADJUSTMENT' ? b.newQuantity : b.quantity, reason: b.reason, reference: b.reference, userId: req.user.id }, s));
  await syncStockAlert(out.product.id).catch(console.error); // after commit: never affects stock
  socketEvents.stockUpdated(out.product.id, {
    type,
    quantity: out.movement.quantity,
    previousQuantity: out.movement.previousQuantity,
    newQuantity: out.movement.newQuantity,
    reference: out.movement.reference,
    reason: out.movement.reason,
  }, req.user.id);
  socketEvents.movementCreated(out.movement.id, {
    productId: out.product.id,
    type,
    quantity: out.movement.quantity,
    previousQuantity: out.movement.previousQuantity,
    newQuantity: out.movement.newQuantity,
    reference: out.movement.reference,
    warnings: out.warnings,
  }, req.user.id);
  res.status(201).json({ movement: out.movement, product: out.product, warnings: out.warnings });
});
r.post('/in', can('stock:write'), validate(stockInSchema), record('IN'));
r.post('/out', can('stock:write'), validate(stockOutSchema), record('OUT'));
r.post('/adjust', can('stock:adjust'), validate(stockAdjustSchema), record('ADJUSTMENT')); // manager/admin only

// GET /api/stock/movements?product=&type=&user=&reference=&from=&to=&page=&limit=
r.get('/movements', can('stock:read'), asyncH(async (req: any, res: any) => {
  const q = req.query, f: any = {};
  if (q.product) f.product = q.product;
  if (q.type) { if (!['IN', 'OUT', 'ADJUSTMENT'].includes(q.type)) throw new AppError(400, 'type must be IN, OUT or ADJUSTMENT'); f.type = q.type; }
  if (q.user) f.user = q.user;
  if (q.reference) f.reference = q.reference;
  if (q.from || q.to) f.createdAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };
  const { page, limit, skip } = paging(q);
  const [data, total] = await Promise.all([
    StockMovement.find(f).populate('product', 'name sku unit').populate('user', 'firstName lastName').sort('-createdAt').skip(skip).limit(limit), StockMovement.countDocuments(f)]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));
// Dashboard widget: every active product at/below its minimum. status = LOW_STOCK or OUT_OF_STOCK.
r.get('/alerts', can('stock:read'), asyncH(async (_q: any, res: any) => {
  const data = await Product.find({ isActive: true, $expr: { $lte: ['$quantity', '$minimumStock'] } }).populate('category', 'name').sort('quantity');
  const out = data.filter((p) => p.quantity === 0).length;
  res.json({ summary: { total: data.length, outOfStock: out, lowStock: data.length - out }, data });
}));
export default r;
