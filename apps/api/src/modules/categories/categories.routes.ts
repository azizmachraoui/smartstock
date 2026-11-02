import { Router } from 'express';
import { categorySchema, categoryUpdateSchema } from '@smartstock/shared';
import { Category, Product } from '../../models';
import { authenticate, can, validate } from '../../middleware';
import { AppError, asyncH } from '../../utils/errors';
import { esc, paging } from '../../utils/query';
import { socketEvents } from '../../socket';

const r = Router(); r.use(authenticate);
const read = can('category:read'), write = can('category:write');
const nameTaken = async (name: string, exceptId?: string) =>
  Category.exists({ name: new RegExp(`^${esc(name)}$`, 'i'), ...(exceptId && { _id: { $ne: exceptId } }) }); // case-insensitive uniqueness

async function assertUnused(id: string) {
  const n = await Product.countDocuments({ category: id, isActive: true });
  if (n > 0) throw new AppError(409, `Cannot deactivate: ${n} active product${n > 1 ? 's' : ''} still use this category. Reassign or deactivate them first.`);
}

// GET /api/categories?search=&isActive=&sort=name&page=&limit=
r.get('/', read, asyncH(async (req: any, res: any) => {
  const q = req.query, f: any = {};
  if (q.search) { const rx = new RegExp(esc(String(q.search)), 'i'); f.$or = [{ name: rx }, { description: rx }]; }
  if (q.isActive !== undefined) f.isActive = q.isActive === 'true'; else if (req.user.role === 'EMPLOYEE') f.isActive = true;
  const { page, limit, skip } = paging(q);
  const sort = ['name', '-name', 'createdAt', '-createdAt'].includes(q.sort) ? q.sort : 'name';
  const [cats, total] = await Promise.all([Category.find(f).sort(sort).skip(skip).limit(limit), Category.countDocuments(f)]);
  const counts = await Product.aggregate([{ $match: { category: { $in: cats.map((c) => c._id) }, isActive: true } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ data: cats.map((c) => ({ ...c.toObject({ virtuals: true }), productCount: map.get(String(c._id)) || 0 })), total, page, limit, pages: Math.ceil(total / limit) });
}));
r.get('/:id', read, asyncH(async (req: any, res: any) => {
  const c = await Category.findById(req.params.id); if (!c) throw new AppError(404, 'Category not found');
  res.json({ ...c.toObject({ virtuals: true }), productCount: await Product.countDocuments({ category: c.id, isActive: true }) });
}));
r.post('/', write, validate(categorySchema), asyncH(async (req: any, res: any) => {
  if (await nameTaken(req.body.name)) throw new AppError(409, `Category "${req.body.name}" already exists`);
  const c = await Category.create(req.body);
  socketEvents.categoryChanged('created', c.id, req.user.id);
  res.status(201).json(c);
}));
r.put('/:id', write, validate(categoryUpdateSchema), asyncH(async (req: any, res: any) => {
  if (req.body.name && (await nameTaken(req.body.name, req.params.id))) throw new AppError(409, `Category "${req.body.name}" already exists`);
  if (req.body.isActive === false) await assertUnused(req.params.id);
  const c = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!c) throw new AppError(404, 'Category not found');
  socketEvents.categoryChanged(req.body.isActive === false ? 'deactivated' : 'updated', c.id, req.user.id);
  res.json(c);
}));
r.delete('/:id', write, asyncH(async (req: any, res: any) => {
  if (!(await Category.exists({ _id: req.params.id }))) throw new AppError(404, 'Category not found');
  await assertUnused(req.params.id);
  await Category.updateOne({ _id: req.params.id }, { isActive: false });
  socketEvents.categoryChanged('deactivated', req.params.id, req.user.id);
  res.json({ message: 'Category deactivated' });
}));
r.post('/:id/reactivate', write, asyncH(async (req: any, res: any) => {
  const c = await Category.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true }); if (!c) throw new AppError(404, 'Category not found');
  socketEvents.categoryChanged('reactivated', c.id, req.user.id);
  res.json(c);
}));
export default r;
