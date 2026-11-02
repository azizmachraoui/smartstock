import { Router } from 'express';
import { supplierSchema, supplierUpdateSchema, ORDER_STATUSES } from '@smartstock/shared';
import { Supplier, Product, Order } from '../../models';
import { authenticate, can, validate } from '../../middleware';
import { AppError, asyncH } from '../../utils/errors';
import { esc, paging } from '../../utils/query';
import { socketEvents } from '../../socket';

const r = Router(); r.use(authenticate);
const read = can('supplier:read'), write = can('supplier:write');
const SORTS = ['name', 'company', 'createdAt'];

async function assertNoOpenOrders(id: string) {
  const n = await Order.countDocuments({ supplier: id, status: { $in: ['PENDING', 'CONFIRMED'] } });
  if (n > 0) throw new AppError(409, `Cannot deactivate: ${n} open order${n > 1 ? 's' : ''} (pending or confirmed) with this supplier.`);
}
async function assertNoDuplicate(b: any, exceptId?: string) {
  const ne = exceptId ? { _id: { $ne: exceptId } } : {};
  if (b.taxNumber && (await Supplier.exists({ taxNumber: b.taxNumber, ...ne }))) throw new AppError(409, `Tax number "${b.taxNumber}" belongs to another supplier`);
  if (b.email && (await Supplier.exists({ email: new RegExp(`^${esc(b.email)}$`, 'i'), ...ne }))) throw new AppError(409, `Email "${b.email}" belongs to another supplier`);
}

// GET /api/suppliers?search=&isActive=&company=&hasEmail=true&sort=-createdAt&page=&limit=
r.get('/', read, asyncH(async (req: any, res: any) => {
  const q = req.query, f: any = {};
  if (q.search) { const rx = new RegExp(esc(String(q.search)), 'i'); f.$or = [{ name: rx }, { company: rx }, { email: rx }, { phone: rx }, { taxNumber: rx }]; }
  if (q.isActive !== undefined) f.isActive = q.isActive === 'true'; else if (req.user.role === 'EMPLOYEE') f.isActive = true;
  if (q.company) f.company = new RegExp(`^${esc(String(q.company))}$`, 'i');
  if (q.hasEmail === 'true') f.email = { $exists: true, $ne: '' };
  const sort = String(q.sort || 'name');
  if (!SORTS.includes(sort.replace(/^-/, ''))) throw new AppError(400, `Cannot sort by "${sort}". Allowed: ${SORTS.join(', ')}`);
  const { page, limit, skip } = paging(q);
  const [data, total] = await Promise.all([Supplier.find(f).sort(sort).skip(skip).limit(limit), Supplier.countDocuments(f)]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

// Details + stats
r.get('/:id', read, asyncH(async (req: any, res: any) => {
  const s = await Supplier.findById(req.params.id); if (!s) throw new AppError(404, 'Supplier not found');
  const [productCount, byStatus] = await Promise.all([
    Product.countDocuments({ supplier: s.id, isActive: true }),
    Order.aggregate([{ $match: { supplier: s._id } }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }]),
  ]);
  const orders = Object.fromEntries(byStatus.map((x) => [x._id, { count: x.count, amount: x.amount }]));
  res.json({ ...s.toObject({ virtuals: true }), stats: { productCount, orderCount: byStatus.reduce((n, x) => n + x.count, 0), totalReceivedAmount: orders.RECEIVED?.amount || 0, byStatus: orders } });
}));

// Order history (needs order:read => manager/admin): ?status=&from=&to=&page=&limit=
r.get('/:id/orders', can('order:read'), asyncH(async (req: any, res: any) => {
  if (!(await Supplier.exists({ _id: req.params.id }))) throw new AppError(404, 'Supplier not found');
  const q = req.query, f: any = { supplier: req.params.id };
  if (q.status) { if (!(ORDER_STATUSES as readonly string[]).includes(q.status)) throw new AppError(400, `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}`); f.status = q.status; }
  if (q.from || q.to) f.createdAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };
  const { page, limit, skip } = paging(q);
  const [data, total] = await Promise.all([
    Order.find(f).populate('items.product', 'name sku').populate('createdBy', 'firstName lastName').sort('-createdAt').skip(skip).limit(limit), Order.countDocuments(f)]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

r.post('/', write, validate(supplierSchema), asyncH(async (req: any, res: any) => {
  await assertNoDuplicate(req.body);
  const s = await Supplier.create(req.body);
  socketEvents.supplierChanged('created', s.id, req.user.id);
  res.status(201).json(s);
}));
r.put('/:id', write, validate(supplierUpdateSchema), asyncH(async (req: any, res: any) => {
  await assertNoDuplicate(req.body, req.params.id);
  if (req.body.isActive === false) await assertNoOpenOrders(req.params.id);
  const s = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!s) throw new AppError(404, 'Supplier not found');
  socketEvents.supplierChanged(req.body.isActive === false ? 'deactivated' : 'updated', s.id, req.user.id);
  res.json(s);
}));
r.delete('/:id', write, asyncH(async (req: any, res: any) => {
  if (!(await Supplier.exists({ _id: req.params.id }))) throw new AppError(404, 'Supplier not found');
  await assertNoOpenOrders(req.params.id);
  await Supplier.updateOne({ _id: req.params.id }, { isActive: false });
  socketEvents.supplierChanged('deactivated', req.params.id, req.user.id);
  res.json({ message: 'Supplier deactivated' });
}));
r.post('/:id/reactivate', write, asyncH(async (req: any, res: any) => {
  const s = await Supplier.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true }); if (!s) throw new AppError(404, 'Supplier not found');
  socketEvents.supplierChanged('reactivated', s.id, req.user.id);
  res.json(s);
}));
export default r;
