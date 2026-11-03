process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { User, Product, Category } from '../src/models';

let server: http.Server;
let baseUrl: string;
let accessToken: string;
let categoryId: string;
const createdFiles: string[] = [];

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

  // Create admin user for product writes
  const email = `product_admin_${Date.now()}@image-test.smartstock.dev`;
  const hashedPassword = await bcrypt.hash('TestPass123!', 10);
  const user = await User.create({
    firstName: 'Product',
    lastName: 'Admin',
    email,
    password: hashedPassword,
    role: 'ADMIN',
    isActive: true,
    tokenVersion: 0,
  });

  // Log in to get accessToken
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass123!' }),
  });
  const loginData = await loginRes.json();
  accessToken = loginData.accessToken;

  // Create test category
  const cat = await Category.create({
    name: `Test Cat ${Date.now()}`,
    description: 'Category for image testing',
  });
  categoryId = cat.id;
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // Clean up files in uploads created during tests
  for (const fileUrl of createdFiles) {
    if (fileUrl.startsWith('/uploads/')) {
      const fullPath = path.join(process.cwd(), fileUrl);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // ignore
        }
      }
    }
  }

  await Product.deleteMany({ name: { $regex: /Image Test Product/i } });
  await Category.deleteMany({ _id: categoryId });
  await User.deleteMany({ email: { $regex: /@image-test\.smartstock\.dev$/i } });
  await mongoose.disconnect();
});

test('Product Image: successfully uploads a valid image file and serves it', async () => {
  // 1. Create product
  const createRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Image Test Product 1',
      category: categoryId,
      purchasePrice: 10,
      sellingPrice: 15,
      quantity: 5,
    }),
  });
  assert.equal(createRes.status, 201);
  const prod = await createRes.json();
  assert.equal(prod.image, undefined);

  // 2. Upload image via multipart/form-data
  const form = new FormData();
  // 1x1 transparent PNG bytes
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  const blob = new Blob([pngBytes], { type: 'image/png' });
  form.append('image', blob, 'sample.png');

  const uploadRes = await fetch(`${baseUrl}/api/products/${prod.id}/image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  assert.equal(uploadRes.status, 200);
  const uploadedProd = await uploadRes.json();
  assert.ok(uploadedProd.image, 'Product should have an image url');
  assert.match(uploadedProd.image, /\.(png|webp|jpe?g)$/i);
  createdFiles.push(uploadedProd.image);

  // 3. Verify static file serving via GET /uploads/...
  const fileRes = await fetch(`${baseUrl}${uploadedProd.image}`);
  assert.equal(fileRes.status, 200);
  assert.match(fileRes.headers.get('content-type') || '', /image\/png/);
});

test('Product Image: fails with 400 when image field is missing', async () => {
  const createRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Image Test Product 2',
      category: categoryId,
      purchasePrice: 10,
      sellingPrice: 15,
      quantity: 5,
    }),
  });
  const prod = await createRes.json();

  // Send multipart form without any file
  const form = new FormData();
  form.append('description', 'no file attached');

  const uploadRes = await fetch(`${baseUrl}/api/products/${prod.id}/image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  assert.equal(uploadRes.status, 400);
  const err = await uploadRes.json();
  assert.equal(err.message, 'Image file is required (field "image")');
});

test('Product Image: fails with 400 when uploaded file is not a supported image format', async () => {
  const createRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Image Test Product 3',
      category: categoryId,
      purchasePrice: 10,
      sellingPrice: 15,
      quantity: 5,
    }),
  });
  const prod = await createRes.json();

  // Send a text file instead of an image
  const form = new FormData();
  const textBlob = new Blob(['hello world text file'], { type: 'text/plain' });
  form.append('image', textBlob, 'document.txt');

  const uploadRes = await fetch(`${baseUrl}/api/products/${prod.id}/image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  assert.equal(uploadRes.status, 400);
  const err = await uploadRes.json();
  assert.equal(err.message, 'Only JPEG, PNG or WebP images are allowed');
});

test('Product Image: DELETE /api/products/:id/image removes the image', async () => {
  // 1. Create product
  const createRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Image Test Product 4',
      category: categoryId,
      purchasePrice: 10,
      sellingPrice: 15,
      quantity: 5,
    }),
  });
  const prod = await createRes.json();

  // 2. Upload image
  const form = new FormData();
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  form.append('image', new Blob([pngBytes], { type: 'image/png' }), 'sample.png');
  const uploadRes = await fetch(`${baseUrl}/api/products/${prod.id}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const uploaded = await uploadRes.json();
  assert.ok(uploaded.image);

  // 3. Delete image
  const delRes = await fetch(`${baseUrl}/api/products/${prod.id}/image`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(delRes.status, 200);
  const deleted = await delRes.json();
  assert.equal(deleted.image, undefined);
});
