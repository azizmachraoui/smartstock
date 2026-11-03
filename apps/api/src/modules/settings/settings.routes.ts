import { Router } from 'express';
import { settingUpdateSchema } from '@smartstock/shared';
import { Setting } from '../../models';
import { authenticate, can, validate } from '../../middleware';
import { asyncH } from '../../utils/errors';
import { socketEvents } from '../../socket';

const r = Router();
r.use(authenticate);

export const DEFAULT_SETTINGS = {
  key: 'app_settings',
  companyName: 'SmartStock Inc.',
  currency: 'USD',
  timezone: 'UTC',
  language: 'en',
  lowStockThreshold: 10,
  emailNotifications: true,
  orderNotifications: true,
  stockNotifications: true,
};

// GET /api/settings: any authenticated user
r.get('/', asyncH(async (_req: any, res: any) => {
  let s = await Setting.findOne({ key: 'app_settings' }).populate('updatedBy', 'firstName lastName email');
  if (!s) {
    s = await Setting.create(DEFAULT_SETTINGS);
  }
  res.json(s);
}));

// PUT /api/settings: ADMIN only
r.put('/', can('settings:manage'), validate(settingUpdateSchema), asyncH(async (req: any, res: any) => {
  const s = await Setting.findOneAndUpdate(
    { key: 'app_settings' },
    { ...req.body, updatedBy: req.user.id },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).populate('updatedBy', 'firstName lastName email');

  socketEvents.settingsChanged(req.user.id);
  res.json(s);
}));

export default r;
