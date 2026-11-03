import { Router } from 'express';
import { authenticate, can } from '../../middleware';
import { Product, StockMovement, Order, Setting } from '../../models';
import { AppError, asyncH } from '../../utils/errors';
import { z } from 'zod';

const router = Router();

// ─── Date-range helpers ───────────────────────────────────────────────────────

const MAX_DAYS = 366;

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
});

function parseDateRange(query: Record<string, unknown>): { fromDate: Date; toDate: Date } {
  const parsed = dateRangeSchema.safeParse(query);
  if (!parsed.success) throw new AppError(400, 'Invalid date parameters: ' + parsed.error.issues[0]?.message);

  const now = new Date();
  const toDate = parsed.data.to
    ? new Date(parsed.data.to + 'T23:59:59.999Z')
    : now;
  const fromDate = parsed.data.from
    ? new Date(parsed.data.from + 'T00:00:00.000Z')
    : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (fromDate > toDate) throw new AppError(400, 'from must be before or equal to to');
  const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_DAYS) throw new AppError(400, `Date range cannot exceed ${MAX_DAYS} days`);

  return { fromDate, toDate };
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

const BOM = '\uFEFF';

/** Neutralize CSV formula injection: values starting with = + - @ get a leading apostrophe */
function safeCsv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  // Wrap in quotes if contains comma, quote, or newline
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(safeCsv).join(',') + '\r\n';
}

// ─── All routes require auth + analytics:read ─────────────────────────────────

router.use(authenticate, can('analytics:read'));

// ─── GET /api/reports/inventory ───────────────────────────────────────────────
// Inventory snapshot: valuation by category, low-stock and out-of-stock lists

router.get('/inventory', asyncH(async (_req: any, res: any) => {
  // Get global low-stock threshold from settings
  const settings = await Setting.findOne({ key: 'app_settings' }).lean();
  const globalThreshold = settings?.lowStockThreshold ?? 10;

  // Inventory valuation by category
  const valuationByCategory = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryDoc',
      },
    },
    {
      $group: {
        _id: { $ifNull: [{ $arrayElemAt: ['$categoryDoc.name', 0] }, 'Uncategorised'] },
        totalValue: {
          $sum: { $multiply: ['$quantity', '$purchasePrice'] },
        },
        productCount: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $project: { _id: 0, category: '$_id', totalValue: 1, productCount: 1, totalQuantity: 1 } },
    { $sort: { totalValue: -1 } },
  ]);

  // Overall totals
  const totalValuation = valuationByCategory.reduce((s, c) => s + c.totalValue, 0);
  const totalProducts = await Product.countDocuments({ isActive: true });

  // Low-stock and out-of-stock
  const lowStock = await Product.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryDoc',
      },
    },
    {
      $addFields: {
        threshold: {
          $cond: [{ $gt: ['$minimumStock', 0] }, '$minimumStock', globalThreshold],
        },
      },
    },
    {
      $match: {
        $expr: {
          $and: [
            { $gt: ['$quantity', 0] },
            { $lte: ['$quantity', '$threshold'] },
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        sku: 1,
        quantity: 1,
        minimumStock: 1,
        purchasePrice: 1,
        category: { $ifNull: [{ $arrayElemAt: ['$categoryDoc.name', 0] }, 'Uncategorised'] },
      },
    },
    { $sort: { quantity: 1 } },
    { $limit: 50 },
  ]);

  const outOfStock = await Product.aggregate([
    { $match: { isActive: true, quantity: 0 } },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryDoc',
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        sku: 1,
        quantity: 1,
        minimumStock: 1,
        purchasePrice: 1,
        category: { $ifNull: [{ $arrayElemAt: ['$categoryDoc.name', 0] }, 'Uncategorised'] },
      },
    },
    { $sort: { name: 1 } },
    { $limit: 50 },
  ]);

  res.json({
    totalValuation,
    totalProducts,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    valuationByCategory,
    lowStock,
    outOfStock,
  });
}));

// ─── GET /api/reports/movements ───────────────────────────────────────────────
// Stock movement trend: IN / OUT / ADJUSTMENT counts and volumes by day

router.get('/movements', asyncH(async (req: any, res: any) => {
  const { fromDate, toDate } = parseDateRange(req.query as any);

  const trend = await StockMovement.aggregate([
    { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          type: '$type',
        },
        count: { $sum: 1 },
        volume: { $sum: '$quantity' },
      },
    },
    {
      $group: {
        _id: '$_id.day',
        types: {
          $push: { type: '$_id.type', count: '$count', volume: '$volume' },
        },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        in: {
          $let: {
            vars: { t: { $filter: { input: '$types', as: 't', cond: { $eq: ['$$t.type', 'IN'] } } } },
            in: { count: { $ifNull: [{ $arrayElemAt: ['$$t.count', 0] }, 0] }, volume: { $ifNull: [{ $arrayElemAt: ['$$t.volume', 0] }, 0] } },
          },
        },
        out: {
          $let: {
            vars: { t: { $filter: { input: '$types', as: 't', cond: { $eq: ['$$t.type', 'OUT'] } } } },
            in: { count: { $ifNull: [{ $arrayElemAt: ['$$t.count', 0] }, 0] }, volume: { $ifNull: [{ $arrayElemAt: ['$$t.volume', 0] }, 0] } },
          },
        },
        adjustment: {
          $let: {
            vars: { t: { $filter: { input: '$types', as: 't', cond: { $eq: ['$$t.type', 'ADJUSTMENT'] } } } },
            in: { count: { $ifNull: [{ $arrayElemAt: ['$$t.count', 0] }, 0] }, volume: { $ifNull: [{ $arrayElemAt: ['$$t.volume', 0] }, 0] } },
          },
        },
      },
    },
  ]);

  // Totals
  const totals = await StockMovement.aggregate([
    { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        volume: { $sum: '$quantity' },
      },
    },
  ]);

  const totalsMap = Object.fromEntries(
    totals.map((t) => [t._id, { count: t.count, volume: t.volume }])
  );

  res.json({
    trend,
    totals: {
      in:         totalsMap['IN']         ?? { count: 0, volume: 0 },
      out:        totalsMap['OUT']        ?? { count: 0, volume: 0 },
      adjustment: totalsMap['ADJUSTMENT'] ?? { count: 0, volume: 0 },
    },
    range: { from: fromDate.toISOString(), to: toDate.toISOString() },
  });
}));

// ─── GET /api/reports/purchases ───────────────────────────────────────────────
// Purchase value: only RECEIVED orders counted

router.get('/purchases', asyncH(async (req: any, res: any) => {
  const { fromDate, toDate } = parseDateRange(req.query as any);

  // By period (day)
  const byPeriod = await Order.aggregate([
    {
      $match: {
        status: 'RECEIVED',
        receivedAt: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$receivedAt' } },
        totalAmount: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', totalAmount: 1, orderCount: 1 } },
  ]);

  // By supplier
  const bySupplier = await Order.aggregate([
    {
      $match: {
        status: 'RECEIVED',
        receivedAt: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $lookup: {
        from: 'suppliers',
        localField: 'supplier',
        foreignField: '_id',
        as: 'supplierDoc',
      },
    },
    {
      $group: {
        _id: { $ifNull: [{ $arrayElemAt: ['$supplierDoc.name', 0] }, 'Unknown'] },
        totalAmount: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
    { $project: { _id: 0, supplier: '$_id', totalAmount: 1, orderCount: 1 } },
    { $limit: 20 },
  ]);

  // Overall totals
  const [overall] = await Order.aggregate([
    {
      $match: {
        status: 'RECEIVED',
        receivedAt: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  res.json({
    totalAmount: overall?.totalAmount ?? 0,
    orderCount: overall?.orderCount ?? 0,
    byPeriod,
    bySupplier,
    range: { from: fromDate.toISOString(), to: toDate.toISOString() },
  });
}));

// ─── GET /api/reports/top-products ────────────────────────────────────────────
// Top N products by total movement volume

router.get('/top-products', asyncH(async (req: any, res: any) => {
  const { fromDate, toDate } = parseDateRange(req.query as any);
  const limitRaw = Number(req.query.limit ?? 10);
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 50 ? limitRaw : 10;

  const topProducts = await StockMovement.aggregate([
    { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
    {
      $group: {
        _id: { product: '$product', type: '$type' },
        volume: { $sum: '$quantity' },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.product',
        totalVolume: { $sum: '$volume' },
        totalCount: { $sum: '$count' },
        byType: {
          $push: { type: '$_id.type', volume: '$volume', count: '$count' },
        },
      },
    },
    { $sort: { totalVolume: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        name: { $ifNull: [{ $arrayElemAt: ['$product.name', 0] }, 'Deleted product'] },
        sku: { $ifNull: [{ $arrayElemAt: ['$product.sku', 0] }, '—'] },
        totalVolume: 1,
        totalCount: 1,
        byType: 1,
      },
    },
  ]);

  res.json({ topProducts, range: { from: fromDate.toISOString(), to: toDate.toISOString() } });
}));

// ─── GET /api/reports/export/:type ────────────────────────────────────────────
// CSV export with UTF-8 BOM and formula-injection protection

router.get('/export/:type', asyncH(async (req: any, res: any) => {
  const { type } = req.params;
  const allowedTypes = ['inventory', 'movements', 'purchases', 'top-products'] as const;
  if (!allowedTypes.includes(type as any)) {
    throw new AppError(400, `Export type must be one of: ${allowedTypes.join(', ')}`);
  }

  const { fromDate, toDate } = parseDateRange(req.query as any);
  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr   = toDate.toISOString().slice(0, 10);
  const filename = `smartstock-${type}-${fromStr}-${toStr}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Write BOM
  res.write(BOM);

  if (type === 'inventory') {
    res.write(csvRow(['Product', 'SKU', 'Category', 'Quantity', 'Purchase Price', 'Valuation']));
    const cursor = Product.find({ isActive: true })
      .populate('category', 'name')
      .lean()
      .cursor();

    for await (const p of cursor) {
      const cat = p.category && typeof p.category === 'object' && 'name' in p.category
        ? (p.category as any).name
        : 'Uncategorised';
      const val = (p.quantity ?? 0) * (p.purchasePrice ?? 0);
      res.write(csvRow([p.name, p.sku, cat, p.quantity ?? 0, p.purchasePrice ?? 0, val.toFixed(2)]));
    }

  } else if (type === 'movements') {
    res.write(csvRow(['Date', 'Type', 'Product', 'SKU', 'Quantity', 'Previous Qty', 'New Qty', 'Reason', 'Reference']));
    const cursor = StockMovement.find({ createdAt: { $gte: fromDate, $lte: toDate } })
      .populate('product', 'name sku')
      .sort({ createdAt: -1 })
      .lean()
      .cursor();

    for await (const m of cursor) {
      const prod = m.product && typeof m.product === 'object' ? (m.product as any) : null;
      res.write(csvRow([
        new Date(m.createdAt as Date).toISOString().slice(0, 10),
        m.type,
        prod?.name ?? 'Deleted',
        prod?.sku ?? '—',
        m.quantity,
        m.previousQuantity ?? '',
        m.newQuantity ?? '',
        m.reason ?? '',
        m.reference ?? '',
      ]));
    }

  } else if (type === 'purchases') {
    res.write(csvRow(['Order #', 'Supplier', 'Status', 'Total Amount', 'Received At']));
    const cursor = Order.find({
      status: 'RECEIVED',
      receivedAt: { $gte: fromDate, $lte: toDate },
    })
      .populate('supplier', 'name')
      .sort({ receivedAt: -1 })
      .lean()
      .cursor();

    for await (const o of cursor) {
      const sup = o.supplier && typeof o.supplier === 'object' ? (o.supplier as any).name : '—';
      res.write(csvRow([
        o.orderNumber,
        sup,
        o.status,
        o.totalAmount.toFixed(2),
        o.receivedAt ? new Date(o.receivedAt).toISOString().slice(0, 10) : '',
      ]));
    }

  } else if (type === 'top-products') {
    res.write(csvRow(['Product', 'SKU', 'Total Volume', 'Total Movements', 'IN Volume', 'OUT Volume', 'ADJUSTMENT Volume']));
    const results = await StockMovement.aggregate([
      { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
      {
        $group: {
          _id: { product: '$product', type: '$type' },
          volume: { $sum: '$quantity' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.product',
          totalVolume: { $sum: '$volume' },
          totalCount: { $sum: '$count' },
          byType: { $push: { type: '$_id.type', volume: '$volume' } },
        },
      },
      { $sort: { totalVolume: -1 } },
      { $limit: 1000 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      {
        $project: {
          name: { $ifNull: [{ $arrayElemAt: ['$product.name', 0] }, 'Deleted'] },
          sku: { $ifNull: [{ $arrayElemAt: ['$product.sku', 0] }, '—'] },
          totalVolume: 1,
          totalCount: 1,
          byType: 1,
        },
      },
    ]);

    for (const r of results) {
      const get = (t: string) => (r.byType as any[]).find((x: any) => x.type === t)?.volume ?? 0;
      res.write(csvRow([r.name, r.sku, r.totalVolume, r.totalCount, get('IN'), get('OUT'), get('ADJUSTMENT')]));
    }
  }

  res.end();
}));

export default router;
