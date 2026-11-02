import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { productSchema, productUpdateSchema } from '@smartstock/shared';
import { Product, Category, Counter, StockMovement } from '../../models';
import { authenticate, can, validate } from '../../middleware';
import { syncStockAlert } from '../alerts/alerts.service';
import { inTransaction, applyMovement } from '../stock/stock.service';
import { AppError, asyncH } from '../../utils/errors';
import { socketEvents } from '../../socket';
import { saveImageFile, deleteImageFile } from '../../services/imageStorage';

const SORTABLE = ['name', 'sku', 'quantity', 'sellingPrice', 'purchasePrice', 'createdAt'];
const POP = [{ path: 'category', select: 'name' }, { path: 'supplier', select: 'name company' }];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// SKU format: <CAT3>-<000123>, backed by an atomic counter so it never collides.
async function generateSku(categoryId: string) {
  const cat = await Category.findById(categoryId);
  if (!cat) throw new AppError(400, 'Category does not exist');
  const prefix = cat.name.normalize('NFD').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  for (let i = 0; i < 5; i++) {
    const c = await Counter.findOneAndUpdate({ _id: `sku:${prefix}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
    const sku = `${prefix}-${String(c.seq).padStart(6, '0')}`;
    if (!(await Product.exists({ sku }))) return sku; // skips SKUs already typed manually
  }
  throw new AppError(500, 'Could not generate a unique SKU');
}

const storage = multer.diskStorage({
  destination: (_q, _f, cb) => { const d = path.join(process.cwd(), 'uploads'); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
  filename: (_q, f, cb) => cb(null, `${crypto.randomUUID()}${path.extname(f.originalname).toLowerCase()}`),
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_q, f, cb) =>
  ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype) ? cb(null, true) : cb(new AppError(400, 'Only JPEG, PNG or WebP images are allowed') as any) });
const removeImage = (url?: string | null) => { if (url?.startsWith('/uploads/')) fs.unlink(path.join(process.cwd(), url), () => {}); };

const r = Router(); r.use(authenticate);
const read = can('product:read'), write = can('product:write');

// GET /api/products?search=&category=&supplier=&isActive=&lowStock=true&minPrice=&maxPrice=&sort=-createdAt&page=1&limit=20
r.get('/', read, asyncH(async (req: any, res: any) => {
  const q = req.query, f: any = {};
  if (q.search) { const rx = new RegExp(esc(String(q.search)), 'i'); f.$or = [{ name: rx }, { sku: rx }, { barcode: rx }]; }
  if (q.category) f.category = q.category;
  if (q.supplier) f.supplier = q.supplier;
  if (q.isActive !== undefined) f.isActive = q.isActive === 'true'; else if (req.user.role === 'EMPLOYEE') f.isActive = true;
  if (q.lowStock === 'true') f.$expr = { $lte: ['$quantity', '$minimumStock'] };
  if (q.outOfStock === 'true') f.quantity = 0;
  if (q.minPrice || q.maxPrice) f.sellingPrice = { ...(q.minPrice && { $gte: +q.minPrice }), ...(q.maxPrice && { $lte: +q.maxPrice }) };
  const sortKey = String(q.sort || '-createdAt'), field = sortKey.replace(/^-/, '');
  if (!SORTABLE.includes(field)) throw new AppError(400, `Cannot sort by "${field}". Allowed: ${SORTABLE.join(', ')}`);
  const page = Math.max(+q.page || 1, 1), limit = Math.min(Math.max(+q.limit || 20, 1), 100);
  const [data, total] = await Promise.all([
    Product.find(f).populate(POP).sort(sortKey).skip((page - 1) * limit).limit(limit), Product.countDocuments(f)]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));

r.get('/generate-sku', write, asyncH(async (req: any, res: any) => {
  if (!req.query.category) throw new AppError(400, 'category query param is required');
  res.json({ sku: await generateSku(String(req.query.category)) }); // preview only; final SKU is re-checked on create
}));

// Used by the scanner (web camera / mobile): exact match on barcode or SKU
r.get('/barcode/:code', read, asyncH(async (req: any, res: any) => {
  const p = await Product.findOne({ $or: [{ barcode: req.params.code }, { sku: req.params.code.toUpperCase() }], isActive: true }).populate(POP);
  if (!p) throw new AppError(404, `No product found for code "${req.params.code}"`); res.json(p);
}));

// Details include recent stock history
r.get('/:id', read, asyncH(async (req: any, res: any) => {
  const p = await Product.findById(req.params.id).populate(POP); if (!p) throw new AppError(404, 'Product not found');
  const recentMovements = await StockMovement.find({ product: p.id }).populate('user', 'firstName lastName').sort('-createdAt').limit(10);
  res.json({ ...p.toJSON(), recentMovements });
}));

r.post('/', write, validate(productSchema), asyncH(async (req: any, res: any) => {
  const b = req.body; if (!b.sku) b.sku = await generateSku(b.category);
  const { quantity, ...data } = b;
  const id = await inTransaction(async (session) => { // product + initial movement commit together
    const sessionOpts = session ? { session } : {};
    const [p] = await Product.create([{ ...data, quantity: 0 }], sessionOpts);
    if (quantity > 0) await applyMovement({ product: p.id, type: 'IN', quantity, reason: 'Initial stock', userId: req.user.id }, session);
    return p.id;
  });
  if (quantity > 0) await syncStockAlert(id).catch(console.error);
  const created = await Product.findById(id).populate(POP);
  socketEvents.productChanged('created', id, req.user.id, { name: created?.name });
  if (quantity > 0) socketEvents.stockUpdated(id, { quantity, previousQuantity: 0, newQuantity: quantity });
  res.status(201).json(created);
}));

r.put('/:id', write, validate(productUpdateSchema), asyncH(async (req: any, res: any) => {
  if (req.body.category && !(await Category.exists({ _id: req.body.category }))) throw new AppError(400, 'Category does not exist');
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate(POP);
  if (!p) throw new AppError(404, 'Product not found');
  await syncStockAlert(p.id).catch(console.error); // minimum stock may have changed
  socketEvents.productChanged('updated', p.id, req.user.id, { name: p.name });
  res.json(p);
}));

r.delete('/:id', write, asyncH(async (req: any, res: any) => { // soft delete: history stays valid
  const p = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!p) throw new AppError(404, 'Product not found');
  await syncStockAlert(p.id).catch(console.error);
  socketEvents.productChanged('deactivated', p.id, req.user.id);
  res.json({ message: 'Product deactivated' });
}));
r.post('/:id/reactivate', write, asyncH(async (req: any, res: any) => {
  const p = await Product.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
  if (!p) throw new AppError(404, 'Product not found');
  await syncStockAlert(p.id).catch(console.error);
  socketEvents.productChanged('reactivated', p.id, req.user.id);
  res.json(p);
}));

// multipart/form-data, field name: "image"
r.post('/:id/image', write, upload.single('image'), asyncH(async (req: any, res: any) => {
  if (!req.file) throw new AppError(400, 'Image file is required (field "image")');
  const p = await Product.findById(req.params.id);
  if (!p) {
    deleteImageFile(`/uploads/${req.file.filename}`);
    throw new AppError(404, 'Product not found');
  }
  const uploaded = await saveImageFile(req.file);
  deleteImageFile(p.image);
  p.image = uploaded.url;
  await p.save();
  socketEvents.productChanged('image-updated', p.id, req.user.id);
  res.json(p);
}));
r.delete('/:id/image', write, asyncH(async (req: any, res: any) => {
  const p = await Product.findById(req.params.id); if (!p) throw new AppError(404, 'Product not found');
  deleteImageFile(p.image); p.image = undefined; await p.save();
  socketEvents.productChanged('image-removed', p.id, req.user.id);
  res.json(p);
}));
export default r;
