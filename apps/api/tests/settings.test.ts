process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { User, Setting } from '../src/models';

let server: http.Server;
let baseUrl: string;

let adminToken: string;
let managerToken: string;
let employeeToken: string;
let testUserEmail: string;

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

  // Ensure clean settings collection for test
  await Setting.deleteMany({});

  // Create test users: ADMIN, MANAGER, EMPLOYEE
  const hashedPassword = await bcrypt.hash('TestPass123!', 10);
  const ts = Date.now();

  const adminEmail = `admin_${ts}@settings-test.smartstock.dev`;
  await User.create({
    firstName: 'Admin',
    lastName: 'User',
    email: adminEmail,
    password: hashedPassword,
    role: 'ADMIN',
    isActive: true,
    tokenVersion: 0,
  });

  const managerEmail = `manager_${ts}@settings-test.smartstock.dev`;
  await User.create({
    firstName: 'Manager',
    lastName: 'User',
    email: managerEmail,
    password: hashedPassword,
    role: 'MANAGER',
    isActive: true,
    tokenVersion: 0,
  });

  testUserEmail = `employee_${ts}@settings-test.smartstock.dev`;
  await User.create({
    firstName: 'Employee',
    lastName: 'User',
    email: testUserEmail,
    password: hashedPassword,
    role: 'EMPLOYEE',
    isActive: true,
    tokenVersion: 0,
  });

  // Log in and grab tokens
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
    body: JSON.stringify({ email: testUserEmail, password: 'TestPass123!' }),
  });
  employeeToken = (await employeeRes.json()).accessToken;
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await Setting.deleteMany({});
  await User.deleteMany({ email: { $regex: /@settings-test\.smartstock\.dev$/i } });
  await mongoose.disconnect();
});

// ─── 1. SETTINGS ENDPOINT TESTS ─────────────────────────────────────────────

test('Settings: unauthenticated GET /api/settings returns 401', async () => {
  const res = await fetch(`${baseUrl}/api/settings`);
  assert.equal(res.status, 401);
});

test('Settings: GET /api/settings returns default settings and persists document when empty', async () => {
  const res = await fetch(`${baseUrl}/api/settings`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.companyName, 'SmartStock Inc.');
  assert.equal(data.currency, 'USD');
  assert.equal(data.timezone, 'UTC');
  assert.equal(data.lowStockThreshold, 10);
  assert.equal(data.emailNotifications, true);

  // Check document exists in DB
  const doc = await Setting.findOne({ key: 'app_settings' });
  assert.ok(doc, 'Settings document must exist in MongoDB');
  assert.equal(doc.companyName, 'SmartStock Inc.');
});

test('Settings: PUT /api/settings allows ADMIN to update configuration', async () => {
  const payload = {
    companyName: 'Acme Logistics Global',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    language: 'fr',
    lowStockThreshold: 25,
    emailNotifications: false,
    orderNotifications: true,
    stockNotifications: true,
  };

  const res = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.companyName, 'Acme Logistics Global');
  assert.equal(updated.currency, 'EUR');
  assert.equal(updated.timezone, 'Europe/Paris');
  assert.equal(updated.lowStockThreshold, 25);
  assert.equal(updated.emailNotifications, false);
  assert.ok(updated.updatedBy);

  // Verify MongoDB document was persisted
  const inDb = await Setting.findOne({ key: 'app_settings' });
  assert.equal(inDb?.companyName, 'Acme Logistics Global');
  assert.equal(inDb?.lowStockThreshold, 25);
});

test('Settings: PUT /api/settings returns 403 Forbidden for MANAGER', async () => {
  const res = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({
      companyName: 'Hacked Name',
      currency: 'USD',
      timezone: 'UTC',
      language: 'en',
      lowStockThreshold: 5,
      emailNotifications: true,
      orderNotifications: true,
      stockNotifications: true,
    }),
  });

  assert.equal(res.status, 403);
  const err = await res.json();
  assert.match(err.message, /Forbidden/i);
});

test('Settings: PUT /api/settings returns 403 Forbidden for EMPLOYEE', async () => {
  const res = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employeeToken}`,
    },
    body: JSON.stringify({
      companyName: 'Hacked Name',
      currency: 'USD',
      timezone: 'UTC',
      language: 'en',
      lowStockThreshold: 5,
      emailNotifications: true,
      orderNotifications: true,
      stockNotifications: true,
    }),
  });

  assert.equal(res.status, 403);
});

test('Settings: PUT /api/settings rejects invalid fields and unknown payload keys (strict)', async () => {
  // 1. Negative lowStockThreshold
  const resNegative = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      companyName: 'Valid Name',
      currency: 'USD',
      timezone: 'UTC',
      language: 'en',
      lowStockThreshold: -5,
      emailNotifications: true,
      orderNotifications: true,
      stockNotifications: true,
    }),
  });
  assert.equal(resNegative.status, 400);

  // 2. Invalid currency (must be 3 characters)
  const resCurrency = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      companyName: 'Valid Name',
      currency: 'TOOLONG',
      timezone: 'UTC',
      language: 'en',
      lowStockThreshold: 10,
      emailNotifications: true,
      orderNotifications: true,
      stockNotifications: true,
    }),
  });
  assert.equal(resCurrency.status, 400);

  // 3. Unknown field injection (strict validation)
  const resUnknown = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      companyName: 'Valid Name',
      currency: 'USD',
      timezone: 'UTC',
      language: 'en',
      lowStockThreshold: 10,
      emailNotifications: true,
      orderNotifications: true,
      stockNotifications: true,
      maliciousField: true,
    }),
  });
  assert.equal(resUnknown.status, 400);
});

// ─── 2. CHANGE PASSWORD TESTS ───────────────────────────────────────────────

test('Change Password: user can change password and old session is revoked', async () => {
  const currentToken = employeeToken;

  const res = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`,
    },
    body: JSON.stringify({
      currentPassword: 'TestPass123!',
      newPassword: 'BrandNewSecuredPass456#',
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.message, /Password changed/i);

  // Old accessToken is revoked
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${currentToken}` },
  });
  assert.equal(meRes.status, 401);

  // New password works for subsequent login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUserEmail,
      password: 'BrandNewSecuredPass456#',
    }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.accessToken);
});

test('Change Password: fails with 400 when current password is wrong', async () => {
  // Re-login to get fresh token
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUserEmail,
      password: 'BrandNewSecuredPass456#',
    }),
  });
  const { accessToken } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: 'CompletelyWrongPassword!',
      newPassword: 'AnotherPassword789$',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.message, 'Current password is incorrect');
});

test('Change Password: fails with 400 when new password is weak', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUserEmail,
      password: 'BrandNewSecuredPass456#',
    }),
  });
  const { accessToken } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: 'BrandNewSecuredPass456#',
      newPassword: 'simple', // Weak: short, no caps, no number, no symbol
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.message, /Validation failed/i);
});
