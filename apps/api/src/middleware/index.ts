import jwt from 'jsonwebtoken';
import { ZodError, ZodTypeAny } from 'zod';
import { hasPermission, Permission, Role } from '@smartstock/shared';
import { env } from '../config/env';
import { User } from '../models';
import { AppError, asyncH } from '../utils/errors';

export const authenticate = asyncH(async (req: any, _res: any, next: any) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw new AppError(401, 'Missing token');
  let payload: any;
  try { payload = jwt.verify(h.slice(7), env.JWT_ACCESS_SECRET); } catch { throw new AppError(401, 'Invalid or expired token'); }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || !user.isActive) throw new AppError(401, 'Account unavailable');
  if (user.tokenVersion !== payload.tv) throw new AppError(401, 'Session revoked');
  req.user = user; next();
});
export const can = (p: Permission) => (req: any, _res: any, next: any) =>
  hasPermission(req.user.role as Role, p) ? next() : next(new AppError(403, 'Forbidden: insufficient permissions'));
export const validate = (schema: ZodTypeAny) => (req: any, _res: any, next: any) => {
  const r = schema.safeParse(req.body); if (!r.success) return next(r.error); req.body = r.data; next();
};
export const errorHandler = (err: any, _req: any, res: any, _next: any) => {
  if (err instanceof ZodError) return res.status(400).json({ message: 'Validation failed', errors: err.flatten().fieldErrors });
  if (err.code === 11000) {
    const keyValue = err.keyValue || {};
    const f = Object.keys(keyValue)[0] || 'field';
    const val = keyValue[f] ? ` "${keyValue[f]}"` : '';
    return res.status(409).json({ message: `${f === 'sku' ? 'SKU' : f}${val} is already in use`, errors: { [f]: [`This ${f} already exists`] } });
  }
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }
  if (err.name === 'MulterError') return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image too large (max 2 MB)' : err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message });
  console.error(err); res.status(500).json({ message: 'Internal server error' });
};
