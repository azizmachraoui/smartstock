import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { registerSchema, loginSchema, forgotSchema, resetSchema, changePasswordSchema, refreshSchema, ROLES } from '@smartstock/shared';
import { env } from '../../config/env';
import { User } from '../../models';
import { authenticate, can, validate } from '../../middleware';
import { AppError, asyncH } from '../../utils/errors';
import { socketEvents } from '../../socket';

const sign = (u: any) => ({
  accessToken: jwt.sign({ sub: u.id, role: u.role, tv: u.tokenVersion }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' }),
  refreshToken: jwt.sign({ sub: u.id, tv: u.tokenVersion }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' }),
});
const pub = (u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role, phone: u.phone, avatar: u.avatar, isActive: u.isActive });
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const r = Router();

// Public registration always creates EMPLOYEE accounts; an admin promotes users.
r.post('/register', validate(registerSchema), asyncH(async (req: any, res: any) => {
  const email = req.body.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(409, 'An account with this email address already exists');
  }
  const { password, firstName, lastName, phone } = req.body;
  const u = await User.create({
    firstName,
    lastName,
    email,
    phone,
    password: await bcrypt.hash(password, 12),
    role: 'EMPLOYEE',
  });
  const full = await User.findById(u.id).select('+tokenVersion');
  res.status(201).json({ user: pub(u), ...sign(full) });
}));
r.post('/login', validate(loginSchema), asyncH(async (req: any, res: any) => {
  const u = await User.findOne({ email: req.body.email }).select('+password +tokenVersion');
  if (!u || !(await bcrypt.compare(req.body.password, u.password))) throw new AppError(401, 'Invalid credentials');
  if (!u.isActive) throw new AppError(403, 'Account deactivated');
  res.json({ user: pub(u), ...sign(u) });
}));
r.post('/refresh', validate(refreshSchema), asyncH(async (req: any, res: any) => {
  let p: any; try { p = jwt.verify(req.body.refreshToken, env.JWT_REFRESH_SECRET); } catch { throw new AppError(401, 'Invalid refresh token'); }
  const u = await User.findById(p.sub).select('+tokenVersion');
  if (!u || !u.isActive || u.tokenVersion !== p.tv) throw new AppError(401, 'Session revoked');
  res.json(sign(u));
}));
r.post('/logout', authenticate, asyncH(async (req: any, res: any) => { await User.findByIdAndUpdate(req.user.id, { $inc: { tokenVersion: 1 } }); res.json({ message: 'Logged out' }); }));
r.get('/me', authenticate, (req: any, res: any) => res.json(pub(req.user)));
r.post('/forgot-password', validate(forgotSchema), asyncH(async (req: any, res: any) => {
  const u = await User.findOne({ email: req.body.email });
  if (u) {
    const token = crypto.randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(u.id, { resetTokenHash: sha(token), resetTokenExpires: new Date(Date.now() + 3600_000) });
    if (env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SmartStock <onboarding@resend.dev>',
            to: [u.email],
            subject: 'SmartStock - Password Reset Request',
            html: `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${env.CLIENT_URL}/reset-password?token=${token}">Reset Password</a></p>`,
          }),
        });
      } catch (err) {
        console.error('Failed to send password reset email via Resend');
      }
    } else {
      console.log(`[AUTH] Password reset requested for user ID ${u.id} (Resend email provider not configured)`);
    }
  }
  res.json({ message: 'If the account exists, a reset link has been sent' });
}));
r.post('/reset-password', validate(resetSchema), asyncH(async (req: any, res: any) => {
  const u = await User.findOne({ resetTokenHash: sha(req.body.token), resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash');
  if (!u) throw new AppError(400, 'Invalid or expired token');
  await User.findByIdAndUpdate(u.id, { password: await bcrypt.hash(req.body.password, 12), $inc: { tokenVersion: 1 }, $unset: { resetTokenHash: 1, resetTokenExpires: 1 } });
  res.json({ message: 'Password updated' });
}));
r.post('/change-password', authenticate, validate(changePasswordSchema), asyncH(async (req: any, res: any) => {
  const u = await User.findById(req.user.id).select('+password');
  if (!u || !(await bcrypt.compare(req.body.currentPassword, u.password))) throw new AppError(400, 'Current password is incorrect');
  await User.findByIdAndUpdate(u.id, { password: await bcrypt.hash(req.body.newPassword, 12), $inc: { tokenVersion: 1 } });
  res.json({ message: 'Password changed, please log in again' });
}));
r.get('/users', authenticate, can('user:manage'), asyncH(async (_q: any, res: any) => res.json(await User.find().sort('-createdAt'))));
r.patch('/users/:id', authenticate, can('user:manage'), validate(z.object({ role: z.enum(ROLES).optional(), isActive: z.boolean().optional() })), asyncH(async (req: any, res: any) => {
  if (req.params.id === req.user.id) throw new AppError(400, 'You cannot modify your own role/status');
  const u = await User.findByIdAndUpdate(req.params.id, { ...req.body, ...(req.body.isActive === false && { $inc: { tokenVersion: 1 } }) }, { new: true });
  if (!u) throw new AppError(404, 'User not found');
  socketEvents.userChanged(u.id, req.body.isActive === false ? 'deactivated' : 'updated', req.user.id);
  res.json(pub(u));
}));
export default r;
