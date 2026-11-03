process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { User } from '../src/models/user';

let server: http.Server;
let baseUrl: string;

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

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
  // Clean up any test users created during test runs
  await User.deleteMany({ email: { $regex: /@auth-test\.smartstock\.dev$/i } });
  await mongoose.disconnect();
});

// Helper to create test user directly in DB
async function createTestUser(opts: {
  email: string;
  password?: string;
  role?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  isActive?: boolean;
}) {
  const password = opts.password || 'TestPass123!';
  const hashedPassword = await bcrypt.hash(password, 10);
  return await User.create({
    firstName: 'Test',
    lastName: 'Subject',
    email: opts.email.toLowerCase().trim(),
    password: hashedPassword,
    role: opts.role || 'EMPLOYEE',
    isActive: opts.isActive ?? true,
    tokenVersion: 0,
  });
}

// ─── 1. LOGIN TESTS ─────────────────────────────────────────────────────────

test('1.1 Login: succeeds with valid credentials and returns tokens + user', async () => {
  const email = `login_success_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, password: 'Passw0rd123!' });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Passw0rd123!' }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.accessToken);
  assert.ok(data.refreshToken);
  assert.equal(data.user.email, email);
  assert.equal(data.user.password, undefined); // Sensitive info not exposed
});

test('1.2 Login: normalizes email with uppercase letters and whitespace', async () => {
  const email = `login_case_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, password: 'Passw0rd123!' });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `  ${email.toUpperCase()}  `,
      password: 'Passw0rd123!',
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.email, email);
});

test('1.3 Login: fails with 401 on incorrect password', async () => {
  const email = `login_badpass_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, password: 'CorrectPassword1!' });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'WrongPassword99!' }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.message, 'Invalid credentials');
});

test('1.4 Login: fails with 401 on non-existent email', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `nonexistent_${Date.now()}@auth-test.smartstock.dev`,
      password: 'Passw0rd123!',
    }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.message, 'Invalid credentials');
});

test('1.5 Login: fails with 403 when account is deactivated', async () => {
  const email = `login_deactivated_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, password: 'Passw0rd123!', isActive: false });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Passw0rd123!' }),
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.message, 'Account deactivated');
});

// ─── 2. LOGOUT & TOKEN REVOCATION ──────────────────────────────────────────

test('2.1 Logout: successfully increments tokenVersion and revokes access', async () => {
  const email = `logout_revocation_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, password: 'Passw0rd123!' });

  // 1. Log in to get tokens
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Passw0rd123!' }),
  });
  const { accessToken } = await loginRes.json();

  // 2. Call logout
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(logoutRes.status, 200);

  // 3. Trying to access /me with old token should now fail with 401 (Session revoked)
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(meRes.status, 401);
  const meData = await meRes.json();
  assert.equal(meData.message, 'Session revoked');
});

// ─── 3. REFRESH TOKEN TESTS ────────────────────────────────────────────────

test('3.1 Refresh: renews accessToken and rotates refreshToken', async () => {
  const email = `refresh_renew_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, password: 'Passw0rd123!' });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Passw0rd123!' }),
  });
  const { refreshToken } = await loginRes.json();

  // Request new token pair
  const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  assert.equal(refreshRes.status, 200);
  const refreshData = await refreshRes.json();
  assert.ok(refreshData.accessToken);
  assert.ok(refreshData.refreshToken);

  // Verify the new accessToken works
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${refreshData.accessToken}` },
  });
  assert.equal(meRes.status, 200);
});

test('3.2 Refresh: fails with 401 for tampered or invalid refresh token', async () => {
  const res = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'invalid.tampered.token1234567890' }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.message, 'Invalid refresh token');
});

test('3.3 Refresh: fails with 401 when refresh token has expired', async () => {
  const email = `refresh_expired_${Date.now()}@auth-test.smartstock.dev`;
  const user = await createTestUser({ email });

  // Generate an already-expired refresh token
  const expiredToken = jwt.sign(
    { sub: user.id, tv: user.tokenVersion },
    env.JWT_REFRESH_SECRET,
    { expiresIn: -10 }, // expired in the past
  );

  const res = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: expiredToken }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.message, /expired/i);
});

// ─── 4. FORGOT PASSWORD TESTS ──────────────────────────────────────────────

test('4.1 Forgot Password: returns generic success message without leaking token', async () => {
  const email = `forgot_success_${Date.now()}@auth-test.smartstock.dev`;
  const user = await createTestUser({ email });

  const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `  ${email.toUpperCase()}  ` }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.message, 'If the account exists, a reset link has been sent');
  assert.equal(data.token, undefined); // Token is NEVER in HTTP response

  // Verify DB user received reset token hash and future expiry
  const updated = await User.findById(user.id).select('+resetTokenHash +resetTokenExpires');
  assert.ok(updated?.resetTokenHash);
  assert.ok(updated?.resetTokenExpires);
  assert.ok(updated.resetTokenExpires.getTime() > Date.now());
});

test('4.2 Forgot Password: non-existent email returns identical message (no enumeration)', async () => {
  const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `ghost_${Date.now()}@auth-test.smartstock.dev` }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.message, 'If the account exists, a reset link has been sent');
});

// ─── 5. RESET PASSWORD TESTS ───────────────────────────────────────────────

test('5.1 Reset Password: valid token updates password and single-use invalidation works', async () => {
  const email = `reset_flow_${Date.now()}@auth-test.smartstock.dev`;
  const user = await createTestUser({ email, password: 'OldPassword1!' });

  const rawToken = crypto.randomBytes(32).toString('hex');
  await User.findByIdAndUpdate(user.id, {
    resetTokenHash: sha(rawToken),
    resetTokenExpires: new Date(Date.now() + 3600_000),
  });

  // 1. Reset password
  const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rawToken, password: 'NewSecurePass123!' }),
  });
  assert.equal(resetRes.status, 200);
  const resetData = await resetRes.json();
  assert.equal(resetData.message, 'Password updated');

  // 2. Token reuse attempt must fail with 400
  const reuseRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rawToken, password: 'AnotherPassword1!' }),
  });
  assert.equal(reuseRes.status, 400);

  // 3. User can log in with new password
  const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'NewSecurePass123!' }),
  });
  assert.equal(newLoginRes.status, 200);

  // 4. Old password no longer works
  const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'OldPassword1!' }),
  });
  assert.equal(oldLoginRes.status, 401);
});

test('5.2 Reset Password: fails with 400 for expired reset token', async () => {
  const email = `reset_expired_${Date.now()}@auth-test.smartstock.dev`;
  const user = await createTestUser({ email });

  const rawToken = crypto.randomBytes(32).toString('hex');
  await User.findByIdAndUpdate(user.id, {
    resetTokenHash: sha(rawToken),
    resetTokenExpires: new Date(Date.now() - 10_000), // expired in past
  });

  const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rawToken, password: 'NewPassword1!' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.message, 'Invalid or expired token');
});

// ─── 6. CHANGE PASSWORD TESTS ──────────────────────────────────────────────

test('6.1 Change Password: authenticated user can change password', async () => {
  const email = `change_pass_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, password: 'CurrentPass1!' });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'CurrentPass1!' }),
  });
  const { accessToken } = await loginRes.json();

  const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: 'CurrentPass1!',
      newPassword: 'BrandNewPassword2@',
    }),
  });

  assert.equal(changeRes.status, 200);
  const data = await changeRes.json();
  assert.match(data.message, /Password changed/i);

  // Old accessToken is now revoked due to tokenVersion increment
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(meRes.status, 401);

  // New password logs in successfully
  const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'BrandNewPassword2@' }),
  });
  assert.equal(newLogin.status, 200);
});

test('6.2 Change Password: fails with 400 when currentPassword is wrong', async () => {
  const email = `change_wrong_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, password: 'ActualPassword1!' });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'ActualPassword1!' }),
  });
  const { accessToken } = await loginRes.json();

  const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: 'IncorrectPassword99!',
      newPassword: 'BrandNewPassword2@',
    }),
  });

  assert.equal(changeRes.status, 400);
  const data = await changeRes.json();
  assert.equal(data.message, 'Current password is incorrect');
});

// ─── 7. ROLE-BASED ACCESS & PERMISSIONS TESTS ──────────────────────────────

test('7.1 Protected Routes: unauthenticated request to /api/auth/users fails with 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/users`);
  assert.equal(res.status, 401);
});

test('7.2 Role Permissions: EMPLOYEE cannot access admin user management (/api/auth/users)', async () => {
  const email = `employee_perm_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email, role: 'EMPLOYEE' });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass123!' }),
  });
  const { accessToken } = await loginRes.json();

  const usersRes = await fetch(`${baseUrl}/api/auth/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(usersRes.status, 403);
  const data = await usersRes.json();
  assert.match(data.message, /Forbidden/i);
});

test('7.3 Role Permissions: ADMIN can access /api/auth/users and manage users', async () => {
  const adminEmail = `admin_perm_${Date.now()}@auth-test.smartstock.dev`;
  await createTestUser({ email: adminEmail, role: 'ADMIN' });

  const targetEmail = `target_user_${Date.now()}@auth-test.smartstock.dev`;
  const targetUser = await createTestUser({ email: targetEmail, role: 'EMPLOYEE' });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: 'TestPass123!' }),
  });
  const { accessToken } = await loginRes.json();

  // 1. ADMIN lists users
  const usersRes = await fetch(`${baseUrl}/api/auth/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(usersRes.status, 200);
  const list = await usersRes.json();
  assert.ok(Array.isArray(list));

  // 2. ADMIN promotes target user to MANAGER
  const patchRes = await fetch(`${baseUrl}/api/auth/users/${targetUser.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ role: 'MANAGER' }),
  });
  assert.equal(patchRes.status, 200);
  const updatedUser = await patchRes.json();
  assert.equal(updatedUser.role, 'MANAGER');
});

test('7.4 Role Permissions: Admin cannot deactivate or modify their own status', async () => {
  const adminEmail = `admin_self_${Date.now()}@auth-test.smartstock.dev`;
  const admin = await createTestUser({ email: adminEmail, role: 'ADMIN' });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: 'TestPass123!' }),
  });
  const { accessToken } = await loginRes.json();

  const patchRes = await fetch(`${baseUrl}/api/auth/users/${admin.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(patchRes.status, 400);
  const data = await patchRes.json();
  assert.match(data.message, /cannot modify your own/i);
});
