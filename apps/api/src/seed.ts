import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { env } from './config/env';
import { User, Category, Supplier, Product, StockMovement, Order } from './models';

export async function seed(reset = false) {
  await mongoose.connect(env.MONGO_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.name}`);

  if (reset) {
    console.log('Resetting database collections...');
    await Order.deleteMany({});
    await StockMovement.deleteMany({});
    await Product.deleteMany({});
    await Supplier.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    console.log('Cleared existing data.');
  }

  // 1. Seed Demo Users
  const pw = await bcrypt.hash('Passw0rd!', 12);
  const demoUsers = [
    { firstName: 'Admin', lastName: 'Demo', email: 'admin@smartstock.dev', role: 'ADMIN' },
    { firstName: 'Manager', lastName: 'Demo', email: 'manager@smartstock.dev', role: 'MANAGER' },
    { firstName: 'Employee', lastName: 'Demo', email: 'employee@smartstock.dev', role: 'EMPLOYEE' },
  ];

  const userMap = new Map<string, any>();
  for (const u of demoUsers) {
    const user = await User.findOneAndUpdate(
      { email: u.email },
      { $setOnInsert: { ...u, password: pw, isActive: true } },
      { upsert: true, new: true },
    );
    userMap.set(u.role, user);
  }
  console.log('✓ Demo users seeded (admin|manager|employee@smartstock.dev / Passw0rd!)');

  const adminUser = userMap.get('ADMIN');

  // 2. Seed Categories
  const categoryNames = [
    { name: 'Electronics', description: 'Gadgets, peripherals and computing equipment' },
    { name: 'Office Supplies', description: 'Stationery, paper, pens and desk essentials' },
    { name: 'Packaging', description: 'Boxes, bubble wrap, packing tape and shipping supplies' },
    { name: 'Hardware & Tools', description: 'Screws, fasteners, cables and toolkits' },
    { name: 'Safety Equipment', description: 'Gloves, safety glasses and protective gear' },
  ];

  const catMap = new Map<string, any>();
  for (const c of categoryNames) {
    const cat = await Category.findOneAndUpdate(
      { name: c.name },
      { $setOnInsert: c },
      { upsert: true, new: true },
    );
    catMap.set(c.name, cat);
  }
  console.log('✓ Categories seeded');

  // 3. Seed Suppliers
  const suppliersData = [
    {
      name: 'Apex Components Ltd',
      company: 'Apex Global Sourcing',
      email: 'orders@apexcomponents.com',
      phone: '+1-555-0192',
      address: '742 Evergreen Terrace, Sector 4, CA',
      taxNumber: 'US-TAX-98214',
    },
    {
      name: 'Paper & Pack Solutions',
      company: 'PackPro Distribution',
      email: 'support@packpro.io',
      phone: '+1-555-0144',
      address: '100 Industrial Parkway, Suite 2B, OH',
      taxNumber: 'US-TAX-33910',
    },
    {
      name: 'Omni Hardware Supply',
      company: 'OmniTrade Corp',
      email: 'sales@omnihardware.com',
      phone: '+1-555-0188',
      address: '404 Logistics Way, Dallas, TX',
      taxNumber: 'US-TAX-77215',
    },
  ];

  const supMap = new Map<string, any>();
  for (const s of suppliersData) {
    const sup = await Supplier.findOneAndUpdate(
      { name: s.name },
      { $setOnInsert: s },
      { upsert: true, new: true },
    );
    supMap.set(s.name, sup);
  }
  console.log('✓ Suppliers seeded');

  // 4. Seed Products
  const productsData = [
    {
      name: 'Logitech MX Master 3S Wireless Mouse',
      sku: 'ELE-000101',
      category: catMap.get('Electronics')._id,
      supplier: supMap.get('Apex Components Ltd')._id,
      purchasePrice: 65,
      sellingPrice: 99,
      quantity: 45,
      minimumStock: 10,
      unit: 'pcs',
      description: 'Ergonomic high-precision performance wireless mouse',
    },
    {
      name: 'USB-C to HDMI 4K Cable 2m',
      sku: 'ELE-000102',
      category: catMap.get('Electronics')._id,
      supplier: supMap.get('Apex Components Ltd')._id,
      purchasePrice: 6,
      sellingPrice: 18,
      quantity: 4, // LOW STOCK (min is 15)
      minimumStock: 15,
      unit: 'pcs',
      description: 'Braided nylon ultra-durable 4K 60Hz display adapter cord',
    },
    {
      name: 'Mechanical Keyboard Cherry MX Brown',
      sku: 'ELE-000103',
      category: catMap.get('Electronics')._id,
      supplier: supMap.get('Apex Components Ltd')._id,
      purchasePrice: 50,
      sellingPrice: 89,
      quantity: 0, // OUT OF STOCK
      minimumStock: 8,
      unit: 'pcs',
      description: 'Tenkeyless RGB tactile mechanical keyboard for workstations',
    },
    {
      name: 'A4 Premium Recycled Copy Paper (500 sheets)',
      sku: 'OFF-000201',
      category: catMap.get('Office Supplies')._id,
      supplier: supMap.get('Paper & Pack Solutions')._id,
      purchasePrice: 3.5,
      sellingPrice: 6.99,
      quantity: 120,
      minimumStock: 30,
      unit: 'reams',
      description: 'High-brightness 80gsm eco-friendly office paper',
    },
    {
      name: 'Heavy Duty Packaging Tape 48mm x 66m (Pack of 6)',
      sku: 'PCK-000301',
      category: catMap.get('Packaging')._id,
      supplier: supMap.get('Paper & Pack Solutions')._id,
      purchasePrice: 7,
      sellingPrice: 14.5,
      quantity: 5, // LOW STOCK (min is 12)
      minimumStock: 12,
      unit: 'packs',
      description: 'Strong solvent adhesive brown parcel sealing tape',
    },
    {
      name: 'Corrugated Shipping Boxes Medium (25 Pack)',
      sku: 'PCK-000302',
      category: catMap.get('Packaging')._id,
      supplier: supMap.get('Paper & Pack Solutions')._id,
      purchasePrice: 15,
      sellingPrice: 28,
      quantity: 0, // OUT OF STOCK
      minimumStock: 10,
      unit: 'bundles',
      description: 'Standard corrugated cardboard mailing cartons 300x200x150mm',
    },
    {
      name: 'Stainless Steel Screwdriver Toolkit 42-in-1',
      sku: 'HRD-000401',
      category: catMap.get('Hardware & Tools')._id,
      supplier: supMap.get('Omni Hardware Supply')._id,
      purchasePrice: 12,
      sellingPrice: 24.99,
      quantity: 32,
      minimumStock: 10,
      unit: 'sets',
      description: 'Precision magnetic magnetic bits set for repairs and assembly',
    },
  ];

  const productMap = new Map<string, any>();
  for (const p of productsData) {
    let product = await Product.findOne({ sku: p.sku });
    if (!product) {
      product = await Product.create(p);
      // Create initial stock movement
      if (p.quantity > 0) {
        await StockMovement.create({
          product: product._id,
          type: 'IN',
          quantity: p.quantity,
          previousQuantity: 0,
          newQuantity: p.quantity,
          reason: 'Initial opening stock intake',
          reference: 'INIT-INVENTORY',
          user: adminUser._id,
        });
      }
    }
    productMap.set(p.sku, product);
  }
  console.log('✓ Products & initial stock movements seeded');

  // 5. Seed Purchase Orders across various statuses (PENDING, CONFIRMED, RECEIVED)
  const sampleOrders = [
    {
      orderNumber: 'PO-2026-0001',
      supplier: supMap.get('Apex Components Ltd')._id,
      status: 'RECEIVED',
      items: [
        {
          product: productMap.get('ELE-000101')._id,
          quantity: 20,
          unitPrice: 65,
        },
      ],
      totalAmount: 1300,
      notes: 'Initial restock batch - delivered and inspected at dock A',
      createdBy: adminUser._id,
      confirmedAt: new Date(Date.now() - 7 * 86400000),
      receivedAt: new Date(Date.now() - 5 * 86400000),
      receivedBy: adminUser._id,
    },
    {
      orderNumber: 'PO-2026-0002',
      supplier: supMap.get('Apex Components Ltd')._id,
      status: 'CONFIRMED',
      items: [
        {
          product: productMap.get('ELE-000103')._id,
          quantity: 30,
          unitPrice: 50,
        },
      ],
      totalAmount: 1500,
      notes: 'Urgent restock for out of stock keyboards. Vendor confirmed shipment.',
      createdBy: adminUser._id,
      confirmedAt: new Date(Date.now() - 2 * 86400000),
      expectedDate: new Date(Date.now() + 3 * 86400000),
    },
    {
      orderNumber: 'PO-2026-0003',
      supplier: supMap.get('Paper & Pack Solutions')._id,
      status: 'PENDING',
      items: [
        {
          product: productMap.get('PCK-000301')._id,
          quantity: 25,
          unitPrice: 7,
        },
        {
          product: productMap.get('PCK-000302')._id,
          quantity: 40,
          unitPrice: 15,
        },
      ],
      totalAmount: 775,
      notes: 'Monthly replenishment order awaiting manager approval',
      createdBy: userMap.get('MANAGER')._id,
      expectedDate: new Date(Date.now() + 5 * 86400000),
    },
  ];

  for (const po of sampleOrders) {
    await Order.findOneAndUpdate(
      { orderNumber: po.orderNumber },
      { $setOnInsert: po },
      { upsert: true, new: true },
    );
  }
  console.log('✓ Purchase Orders seeded (PENDING, CONFIRMED, RECEIVED)');

  console.log('\n=============================================');
  console.log('Database successfully seeded!');
  console.log('Demo Credentials:');
  console.log('  - Admin:    admin@smartstock.dev    / Passw0rd!');
  console.log('  - Manager:  manager@smartstock.dev  / Passw0rd!');
  console.log('  - Employee: employee@smartstock.dev / Passw0rd!');
  console.log('=============================================\n');
}

if (require.main === module) {
  const isReset = process.argv.includes('--reset');
  seed(isReset)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
