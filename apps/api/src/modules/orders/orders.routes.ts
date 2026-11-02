import { Router } from 'express';
import { orderSchema, orderUpdateSchema, orderCancelSchema, ORDER_STATUSES } from '@smartstock/shared';
import { Order, Product, Supplier, Counter } from '../../models';
import { authenticate, can, validate } from '../../middleware';
import { AppError, asyncH } from '../../utils/errors';
import { esc, paging } from '../../utils/query';
import { applyMovement, inTransaction } from '../stock/stock.service';
import { syncStockAlert } from '../alerts/alerts.service';
import { socketEvents } from '../../socket';

const r = Router(); r.use(authenticate);
const read = can('order:read'), write = can('order:write');
const POP = [{ path: 'supplier', select: 'name company email phone' }, { path: 'items.product', select: 'name sku unit' }, { path: 'createdBy', select: 'firstName lastName' }, { path: 'receivedBy', select: 'firstName lastName' }];
const SORTS = ['createdAt', 'orderNumber', 'totalAmount', 'expectedDate', 'status'];

// Totals are always computed server-side from quantity x unit price (unit price defaults to the product's purchase price).
async function buildItems(items: { product: string; quantity: number; unitPrice?: number }[]) {
  const ids = items.map((i) => i.product);
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'The same product appears on more than one line; merge them into one line');
  const map = new Map((await Product.find({ _id: { $in: ids } })).map((p) => [p.id, p]));
  const lines = items.map((i) => {
    const p = map.get(i.product); if (!p || !p.isActive) throw new AppError(400, `Product ${i.product} does not exist or is inactive`);
    return { product: p._id, quantity: i.quantity, unitPrice: i.unitPrice ?? p.purchasePrice };
  });
  return { items: lines, totalAmount: Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100 };
}
async function assertSupplier(id: string) { const s = await Supplier.findById(id); if (!s || !s.isActive) throw new AppError(400, 'Supplier does not exist or is inactive'); }
async function nextNumber() {
  const y = new Date().getFullYear(); const c = await Counter.findOneAndUpdate({ _id: `po:${y}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `PO-${y}-${String(c.seq).padStart(5, '0')}`;
}
const full = (id: string) => Order.findById(id).populate(POP);

// GET /api/orders?status=&supplier=&search=&from=&to=&sort=-createdAt&page=&limit=
r.get('/', read, asyncH(async (req: any, res: any) => {
  const q = req.query, f: any = {};
  if (q.status) { if (!(ORDER_STATUSES as readonly string[]).includes(q.status)) throw new AppError(400, `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}`); f.status = q.status; }
  if (q.supplier) f.supplier = q.supplier;
  if (q.search) f.orderNumber = new RegExp(esc(String(q.search)), 'i');
  if (q.from || q.to) f.createdAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };
  const sort = String(q.sort || '-createdAt');
  if (!SORTS.includes(sort.replace(/^-/, ''))) throw new AppError(400, `Cannot sort by "${sort}". Allowed: ${SORTS.join(', ')}`);
  const { page, limit, skip } = paging(q);
  const [data, total] = await Promise.all([Order.find(f).populate(POP.slice(0, 1)).sort(sort).skip(skip).limit(limit), Order.countDocuments(f)]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));
r.get('/:id', read, asyncH(async (req: any, res: any) => { const o = await full(req.params.id); if (!o) throw new AppError(404, 'Order not found'); res.json(o); }));

// Save (status PENDING)
r.post('/', write, validate(orderSchema), asyncH(async (req: any, res: any) => {
  const b = req.body; await assertSupplier(b.supplier);
  const o = await Order.create({ orderNumber: await nextNumber(), supplier: b.supplier, ...(await buildItems(b.items)), expectedDate: b.expectedDate, notes: b.notes, createdBy: req.user.id });
  const created = await full(o.id);
  socketEvents.orderCreated(o.id, {
    orderNumber: o.orderNumber,
    status: o.status,
    supplierId: String(o.supplier),
    totalAmount: o.totalAmount,
  }, req.user.id);
  res.status(201).json(created);
}));

// Edit lines / quantities / supplier / date: PENDING orders only
r.put('/:id', write, validate(orderUpdateSchema), asyncH(async (req: any, res: any) => {
  const b = req.body, set: any = {};
  if (b.supplier) { await assertSupplier(b.supplier); set.supplier = b.supplier; }
  if (b.items) Object.assign(set, await buildItems(b.items));
  for (const k of ['expectedDate', 'notes']) if (b[k] !== undefined) set[k] = b[k];
  const o = await Order.findOneAndUpdate({ _id: req.params.id, status: 'PENDING' }, set, { new: true, runValidators: true });
  if (!o) throw new AppError((await Order.exists({ _id: req.params.id })) ? 409 : 404, (await Order.exists({ _id: req.params.id })) ? 'Only PENDING orders can be edited' : 'Order not found');
  const updated = await full(o.id);
  socketEvents.orderUpdated(o.id, { status: o.status, totalAmount: o.totalAmount }, req.user.id);
  res.json(updated);
}));

// Guarded transitions: the status check is part of the update, so double clicks / races cannot apply twice.
const transition = (from: string[], to: string, extra: (req: any) => any = () => ({})) => asyncH(async (req: any, res: any) => {
  const o = await Order.findOneAndUpdate({ _id: req.params.id, status: { $in: from } }, { status: to, [`${to.toLowerCase()}At`]: new Date(), ...extra(req) }, { new: true });
  if (!o) { const cur = await Order.findById(req.params.id); if (!cur) throw new AppError(404, 'Order not found'); throw new AppError(409, `Cannot move a ${cur.status} order to ${to}`); }
  const updated = await full(o.id);
  socketEvents.orderStatusChanged(o.id, to, req.user.id);
  res.json(updated);
});
r.post('/:id/confirm', write, transition(['PENDING'], 'CONFIRMED'));
r.post('/:id/cancel', write, validate(orderCancelSchema), transition(['PENDING', 'CONFIRMED'], 'CANCELLED', (req) => ({ cancelReason: req.body.reason })));

// RECEIVE: status change + one StockMovement(IN) per line + quantity updates, all in ONE transaction.
// If any line fails (e.g. product deactivated), everything rolls back and the order stays CONFIRMED.
r.post('/:id/receive', write, asyncH(async (req: any, res: any) => {
  const { order, movements } = await inTransaction(async (s) => {
    const sessionOpts = s ? { session: s } : {};
    const o = await Order.findOneAndUpdate({ _id: req.params.id, status: 'CONFIRMED' }, { status: 'RECEIVED', receivedAt: new Date(), receivedBy: req.user.id }, { new: true, ...sessionOpts });
    if (!o) { const cur = s ? await Order.findById(req.params.id).session(s) : await Order.findById(req.params.id); throw cur ? new AppError(409, `Only CONFIRMED orders can be received (this one is ${cur.status})`) : new AppError(404, 'Order not found'); }
    const applied = [];
    for (const it of o.items)
      applied.push(await applyMovement({ product: String(it.product), type: 'IN', quantity: it.quantity, reason: `Purchase order ${o.orderNumber} received`, reference: o.orderNumber, userId: req.user.id }, s));
    return { order: o, movements: applied };
  });
  for (const it of order.items) await syncStockAlert(String(it.product)).catch(console.error); // resolves alerts, after commit
  for (const applied of movements) {
    socketEvents.stockUpdated(applied.product.id, {
      type: 'IN',
      quantity: applied.movement.quantity,
      previousQuantity: applied.movement.previousQuantity,
      newQuantity: applied.movement.newQuantity,
      reference: applied.movement.reference,
    }, req.user.id);
    socketEvents.movementCreated(applied.movement.id, {
      productId: applied.product.id,
      type: 'IN',
      quantity: applied.movement.quantity,
      previousQuantity: applied.movement.previousQuantity,
      newQuantity: applied.movement.newQuantity,
      reference: applied.movement.reference,
    }, req.user.id);
  }
  const updated = await full(order.id);
  socketEvents.orderStatusChanged(order.id, 'RECEIVED', req.user.id);
  res.json(updated);
}));
export default r;
