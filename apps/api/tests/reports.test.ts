process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { User, Category, Supplier, Product, StockMovement, Order, Setting } from '../src/models';

let server: http.Server;
let baseUrl: string;

let adminToken: string;
let managerToken: string;
let employeeToken: string;
let adminUserId: string;

const runId = Date.now();
const testEmailDomain = `@reports-test-${runId}.smartstock.dev`;

test.before(async () => {
  await mongoose.connect(env.MONGO_URI);
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  // Ensure default app_settings exists
  await Setting.findOneAndUpdate(
    { key: 'app_settings' },
    { $setOnInsert: { key: 'app_settings', lowStockThreshold: 10 } },
    { upsert: true }
  );

  const hashedPassword = await bcrypt.hash('TestPass123!', 10);

  const adminEmail = `admin${testEmailDomain}`;
  const adminUser = await User.create({
    firstName: 'Admin',
    lastName: 'Reporter',
    email: adminEmail,
    password: hashedPassword,
    role: 'ADMIN',
    isActive: true,
    tokenVersion: 0,
  });
  adminUserId = adminUser._id.toString();

  const managerEmail = `manager${testEmailDomain}`;
  await User.create({
    firstName: 'Manager',
    lastName: 'Reporter',
    email: managerEmail,
    password: hashedPassword,
    role: 'MANAGER',
    isActive: true,
    tokenVersion: 0,
  });

  const employeeEmail = `employee${testEmailDomain}`;
  await User.create({
    firstName: 'Employee',
    lastName: 'Reporter',
    email: employeeEmail,
    password: hashedPassword,
    role: 'EMPLOYEE',
    isActive: true,
    tokenVersion: 0,
  });

  // Log in
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: 'TestPass123!' }),
  });
  adminToken = (await adminRes.json()).accessToken;

  const managerRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: managerEmail, password: 'TestPass123!' }),
  });
  managerToken = (await managerRes.json()).accessToken;

  const employeeRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: employeeEmail, password: 'TestPass123!' }),
  });
  employeeToken = (await employeeRes.json()).accessToken;

  // Seed sample data for reports
  const cat = await Category.create({ name: `Electronics_${runId}` });
  const sup = await Supplier.create({ name: `Supplier_${runId}`, email: `sup_${runId}@vendor.com` });

  const p1 = await Product.create({
    name: `=Product Formula_${runId}`,
    sku: `SKU-REP1-${runId}`,
    category: cat._id,
    supplier: sup._id,
    purchasePrice: 20,
    sellingPrice: 40,
    quantity: 5,
    minimumStock: 8,
    unit: 'pcs',
    isActive: true,
  });

  const p2 = await Product.create({
    name: `@Product At_${runId}`,
    sku: `SKU-REP2-${runId}`,
    category: cat._id,
    supplier: sup._id,
    purchasePrice: 50,
    sellingPrice: 100,
    quantity: 0,
    minimumStock: 5,
    unit: 'pcs',
    isActive: true,
  });

  const p3 = await Product.create({
    name: `Product Normal_${runId}`,
    sku: `SKU-REP3-${runId}`,
    category: cat._id,
    supplier: sup._id,
    purchasePrice: 15,
    sellingPrice: 30,
    quantity: 100,
    minimumStock: 10,
    unit: 'pcs',
    isActive: true,
  });

  // Seed stock movements
  await StockMovement.create({
    product: p3._id,
    type: 'IN',
    quantity: 50,
    previousQuantity: 50,
    newQuantity: 100,
    reason: 'Initial stock',
    user: adminUser._id,
  });

  await StockMovement.create({
    product: p1._id,
    type: 'OUT',
    quantity: 10,
    previousQuantity: 15,
    newQuantity: 5,
    reason: 'Usage',
    user: adminUser._id,
  });

  // Seed orders: one RECEIVED, one PENDING, one CANCELLED
  await Order.create({
    orderNumber: `ORD-REC-${runId}`,
    supplier: sup._id,
    items: [{ product: p3._id, quantity: 50, unitPrice: 15 }],
    totalAmount: 750,
    status: 'RECEIVED',
    receivedAt: new Date(),
    createdBy: adminUser._id,
  });

  await Order.create({
    orderNumber: `ORD-PEND-${runId}`,
    supplier: sup._id,
    items: [{ product: p3._id, quantity: 20, unitPrice: 15 }],
    totalAmount: 300,
    status: 'PENDING',
    createdBy: adminUser._id,
  });

  await Order.create({
    orderNumber: `ORD-CANC-${runId}`,
    supplier: sup._id,
    items: [{ product: p3._id, quantity: 10, unitPrice: 15 }],
    totalAmount: 150,
    status: 'CANCELLED',
    createdBy: adminUser._id,
  });
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await User.deleteMany({ email: { $regex: new RegExp(testEmailDomain.replace('.', '\\.'), 'i') } });
  await Product.deleteMany({ sku: { $regex: new RegExp(`SKU-REP.*-${runId}`) } });
  await Category.deleteMany({ name: `Electronics_${runId}` });
  await Supplier.deleteMany({ name: `Supplier_${runId}` });
  await Order.deleteMany({ orderNumber: { $regex: new RegExp(`ORD-.*-${runId}`) } });
  await StockMovement.collection.deleteMany({ user: new mongoose.Types.ObjectId(adminUserId) });
  await mongoose.disconnect();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test('GET /api/reports/inventory: returns valuation and stock alerts for ADMIN', async () => {
  const res = await fetch(`${baseUrl}/api/reports/inventory`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(typeof data.totalValuation === 'number');
  assert.ok(data.totalValuation >= 1600); // 5*20 + 0*50 + 100*15 = 1600 from seeded items
  assert.ok(Array.isArray(data.valuationByCategory));
  assert.ok(Array.isArray(data.lowStock));
  assert.ok(Array.isArray(data.outOfStock));

  // Verify lowStock contains p1 (qty 5 <= min 8)
  const lowItem = data.lowStock.find((p: any) => p.sku === `SKU-REP1-${runId}`);
  assert.ok(lowItem, 'p1 should be in lowStock');

  // Verify outOfStock contains p2 (qty 0)
  const outItem = data.outOfStock.find((p: any) => p.sku === `SKU-REP2-${runId}`);
  assert.ok(outItem, 'p2 should be in outOfStock');
});

test('GET /api/reports/inventory: MANAGER can access, EMPLOYEE gets 403, anonymous gets 401', async () => {
  const mgrRes = await fetch(`${baseUrl}/api/reports/inventory`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  assert.equal(mgrRes.status, 200);

  const empRes = await fetch(`${baseUrl}/api/reports/inventory`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  assert.equal(empRes.status, 403);

  const anonRes = await fetch(`${baseUrl}/api/reports/inventory`);
  assert.equal(anonRes.status, 401);
});

test('GET /api/reports/movements: aggregates IN and OUT movements', async () => {
  const res = await fetch(`${baseUrl}/api/reports/movements`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(Array.isArray(data.trend));
  assert.ok(data.totals);
  assert.ok(data.totals.in.volume >= 50);
  assert.ok(data.totals.out.volume >= 10);
});

test('GET /api/reports/purchases: only counts RECEIVED orders, excludes PENDING and CANCELLED', async () => {
  const res = await fetch(`${baseUrl}/api/reports/purchases`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(typeof data.totalAmount === 'number');
  assert.ok(data.totalAmount >= 750);
  assert.ok(Array.isArray(data.byPeriod));
  assert.ok(Array.isArray(data.bySupplier));

  const seededSupplier = data.bySupplier.find((s: any) => s.supplier === `Supplier_${runId}`);
  assert.ok(seededSupplier, 'seeded supplier must be present');
  assert.equal(seededSupplier.totalAmount, 750); // Exactly the received order amount
  assert.equal(seededSupplier.orderCount, 1);
});

test('GET /api/reports/top-products: returns highest movement volume products', async () => {
  const res = await fetch(`${baseUrl}/api/reports/top-products?limit=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(Array.isArray(data.topProducts));
  assert.ok(data.topProducts.length <= 5);
  if (data.topProducts.length > 0) {
    assert.ok(typeof data.topProducts[0].totalVolume === 'number');
  }
});

test('Date range validation: rejects from > to and range > 366 days', async () => {
  const inverted = await fetch(`${baseUrl}/api/reports/movements?from=2026-05-10&to=2026-05-01`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(inverted.status, 400);

  const tooLong = await fetch(`${baseUrl}/api/reports/movements?from=2024-01-01&to=2026-01-01`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(tooLong.status, 400);
});

test('Empty date range returns zero totals and empty arrays', async () => {
  const res = await fetch(`${baseUrl}/api/reports/purchases?from=2015-01-01&to=2015-01-02`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.totalAmount, 0);
  assert.equal(data.orderCount, 0);
  assert.equal(data.byPeriod.length, 0);
  assert.equal(data.bySupplier.length, 0);
});

test('GET /api/reports/export/inventory: returns CSV with UTF-8 BOM and neutralizes formula injection', async () => {
  const res = await fetch(`${baseUrl}/api/reports/export/inventory`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type')?.includes('text/csv'));
  assert.ok(res.headers.get('content-disposition')?.includes('attachment; filename='));

  const buffer = Buffer.from(await res.arrayBuffer());

  // Check UTF-8 BOM bytes on the wire (0xEF, 0xBB, 0xBF)
  assert.equal(buffer[0], 0xEF);
  assert.equal(buffer[1], 0xBB);
  assert.equal(buffer[2], 0xBF);

  const text = buffer.toString('utf8');

  // Check header
  assert.ok(text.includes('Product,SKU,Category,Quantity,Purchase Price,Valuation'));

  // Formula injection checks: '=Product Formula' should be neutralised to ''=Product Formula'
  assert.ok(text.includes(`'=Product Formula_${runId}`));
  // '@Product At' should be neutralised to ''@Product At'
  assert.ok(text.includes(`'@Product At_${runId}`));
});

test('GET /api/reports/export/unknown: returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/reports/export/invalid_type`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 400);
});
