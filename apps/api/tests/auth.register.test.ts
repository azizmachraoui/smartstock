process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { User } from '../src/models/user';

let server: http.Server;
let baseUrl: string;

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
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  // Clean up any test users created during testing
  await User.deleteMany({ email: { $regex: /@register-test\.smartstock\.dev$/i } });
  await mongoose.disconnect();
});

test('Registration: succeeds with valid input and default role EMPLOYEE', async () => {
  const email = `employee_${Date.now()}@register-test.smartstock.dev`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Alice',
      lastName: 'Smith',
      email,
      phone: '+1 555-0199',
      password: 'SecurePassword1!',
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();

  // Validate response structure
  assert.ok(data.user);
  assert.equal(data.user.email, email);
  assert.equal(data.user.firstName, 'Alice');
  assert.equal(data.user.lastName, 'Smith');
  assert.equal(data.user.role, 'EMPLOYEE');
  assert.equal(data.user.isActive, true);

  // Security check: password is NEVER returned in response
  assert.equal(data.user.password, undefined);
  assert.equal(data.password, undefined);

  // Token pair check
  assert.ok(data.accessToken);
  assert.ok(data.refreshToken);

  // Validate database state
  const dbUser = await User.findOne({ email }).select('+password');
  assert.ok(dbUser);
  assert.equal(dbUser.role, 'EMPLOYEE');
  assert.ok(await bcrypt.compare('SecurePassword1!', dbUser.password));
});

test('Registration: fails with 409 when registering duplicate email', async () => {
  const email = `dup_${Date.now()}@register-test.smartstock.dev`;
  // First registration
  const firstRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Bob',
      lastName: 'Jones',
      email,
      password: 'SecurePassword1!',
    }),
  });
  assert.equal(firstRes.status, 201);

  // Attempt duplicate registration
  const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'BobDuplicate',
      lastName: 'Jones',
      email,
      password: 'SecurePassword2!',
    }),
  });

  assert.equal(dupRes.status, 409);
  const errData = await dupRes.json();
  assert.ok(errData.message);
  assert.match(errData.message, /already (exists|in use)/i);
});

test('Registration: fails with 400 for invalid inputs', async () => {
  // Empty payload
  const emptyRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(emptyRes.status, 400);
  const emptyData = await emptyRes.json();
  assert.ok(emptyData.errors);
  assert.ok(emptyData.errors.firstName);
  assert.ok(emptyData.errors.lastName);
  assert.ok(emptyData.errors.email);
  assert.ok(emptyData.errors.password);

  // Invalid email format
  const badEmailRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      email: 'not-an-email',
      password: 'SecurePassword1!',
    }),
  });
  assert.equal(badEmailRes.status, 400);

  // Weak password: less than 8 chars
  const shortPassRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.weak@register-test.smartstock.dev',
      password: 'Pass1',
    }),
  });
  assert.equal(shortPassRes.status, 400);

  // Weak password: missing uppercase
  const noUpperRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.weak@register-test.smartstock.dev',
      password: 'password123',
    }),
  });
  assert.equal(noUpperRes.status, 400);

  // Weak password: missing digit
  const noDigitRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.weak@register-test.smartstock.dev',
      password: 'PasswordNoDigit',
    }),
  });
  assert.equal(noDigitRes.status, 400);
});

test('Registration: cannot escalate role to ADMIN or MANAGER', async () => {
  const email = `escalate_${Date.now()}@register-test.smartstock.dev`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Hacker',
      lastName: 'Admin',
      email,
      password: 'SecurePassword1!',
      role: 'ADMIN',
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.user.role, 'EMPLOYEE');

  // Verify in DB that role is strictly EMPLOYEE
  const dbUser = await User.findOne({ email });
  assert.ok(dbUser);
  assert.equal(dbUser.role, 'EMPLOYEE');
});

test('Registration: new user can immediately log in after registering', async () => {
  const email = `login_after_${Date.now()}@register-test.smartstock.dev`;
  const password = 'FreshUserPassword1!';

  // 1. Register
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Fresh',
      lastName: 'User',
      email,
      password,
    }),
  });
  assert.equal(regRes.status, 201);

  // 2. Login immediately
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.accessToken);
  assert.ok(loginData.refreshToken);
  assert.equal(loginData.user.email, email);
  assert.equal(loginData.user.role, 'EMPLOYEE');
});
