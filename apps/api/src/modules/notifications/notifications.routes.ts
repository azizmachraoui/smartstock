import { Router } from 'express';
import { Notification } from '../../models';
import { authenticate } from '../../middleware';
import { AppError, asyncH } from '../../utils/errors';
import { paging } from '../../utils/query';
import { socketEvents } from '../../socket';

const r = Router(); r.use(authenticate); // every user only ever sees their own notifications

// GET /api/notifications?isRead=&resolved=&type=&page=&limit=
r.get('/', asyncH(async (req: any, res: any) => {
  const q = req.query, f: any = { user: req.user.id };
  if (q.isRead !== undefined) f.isRead = q.isRead === 'true';
  if (q.resolved !== undefined) f.resolved = q.resolved === 'true';
  if (q.type) f.type = q.type;
  const { page, limit, skip } = paging(q);
  const [data, total] = await Promise.all([
    Notification.find(f).populate('relatedProduct', 'name sku quantity minimumStock unit').sort('-createdAt').skip(skip).limit(limit), Notification.countDocuments(f)]);
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
}));
r.get('/unread-count', asyncH(async (req: any, res: any) => res.json({ count: await Notification.countDocuments({ user: req.user.id, isRead: false, resolved: false }) })));
r.post('/read-all', asyncH(async (req: any, res: any) => {
  await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
  socketEvents.notificationChanged(req.user.id, 'all', 'read-all');
  res.json({ message: 'All notifications marked as read' });
}));
r.patch('/:id/read', asyncH(async (req: any, res: any) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { isRead: true }, { new: true });
  if (!n) throw new AppError(404, 'Notification not found');
  socketEvents.notificationChanged(req.user.id, n.id, 'read');
  res.json(n);
}));
export default r;
