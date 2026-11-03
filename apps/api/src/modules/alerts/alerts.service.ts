import { stockStatusOf } from '@smartstock/shared';
import { Product, Notification, User, Setting } from '../../models';
import { socketEvents } from '../../socket';

const isDup = (e: any) => e?.code === 11000 || (Array.isArray(e?.writeErrors) && e.writeErrors.length > 0 && e.writeErrors.every((w: any) => (w.code ?? w.err?.code) === 11000));

/**
 * Idempotent: makes the open notifications match the product's CURRENT status. Safe to call any time, after commit.
 *  - OK            -> all open alerts for the product are resolved
 *  - LOW_STOCK     -> open OUT_OF_STOCK alerts resolved; one open LOW_STOCK alert per admin/manager (no duplicates)
 *  - OUT_OF_STOCK  -> open LOW_STOCK alerts resolved; one open OUT_OF_STOCK alert per admin/manager
 * A unique partial index on (user, dedupeKey) guarantees no duplicate open alert even under concurrent calls.
 */
export async function syncStockAlert(productId: string) {
  const p = await Product.findById(productId);
  if (!p) return;

  // Use product minimumStock if explicitly set (> 0); otherwise fall back to global Setting threshold
  let minStock = p.minimumStock;
  if (minStock === undefined || minStock === null || minStock <= 0) {
    const s = await Setting.findOne({ key: 'app_settings' });
    minStock = s?.lowStockThreshold ?? 10;
  }

  const status = p.isActive ? stockStatusOf(p.quantity, minStock) : 'OK'; // inactive products raise no alerts
  const keep = status === 'OK' ? null : status;
  const stale = (['LOW_STOCK', 'OUT_OF_STOCK'] as const).filter((t) => t !== keep);
  await Notification.updateMany({ relatedProduct: p._id, type: { $in: stale }, resolved: false }, { $set: { resolved: true, resolvedAt: new Date() }, $unset: { dedupeKey: 1 } });
  if (!keep) return;
  const out = keep === 'OUT_OF_STOCK';
  const message = out ? `${p.name} (${p.sku}) is OUT OF STOCK` : `${p.name} (${p.sku}) is low: ${p.quantity} ${p.unit} left (minimum ${minStock})`;
  const alertData = { productId: p.id, name: p.name, sku: p.sku, quantity: p.quantity, minimumStock: minStock, unit: p.unit, message };
  if (out) socketEvents.productOutOfStock(p.id, alertData); else socketEvents.productLowStock(p.id, alertData);
  await Notification.updateMany({ relatedProduct: p._id, type: keep, resolved: false }, { $set: { message } }); // refresh text, keep the same alert
  const staff = await User.find({ role: { $in: ['ADMIN', 'MANAGER'] }, isActive: true }).select('_id');
  const docs = staff.map((s) => ({ user: s._id, type: keep, title: out ? 'Out of stock' : 'Low stock', message, relatedProduct: p._id, dedupeKey: `${keep}:${p.id}` }));
  try {
    const created = await Notification.insertMany(docs, { ordered: false });
    for (const n of created) socketEvents.notificationNew(String(n.user), n.toJSON() as unknown as Record<string, unknown>);
  } catch (e) { if (!isDup(e)) throw e; } // duplicates = alert already open, which is exactly what we want
}
