import { Router } from 'express';
import dayjs from 'dayjs';
import { db } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Notification, User } from '../types';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const type = req.query.type as string | undefined;
  const is_read = req.query.is_read as string | undefined;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);

  let query = 'SELECT * FROM notifications WHERE user_id = ?';
  const params: any[] = [req.user.id];

  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }
  if (is_read !== undefined && is_read !== 'all') {
    query += ' AND is_read = ?';
    params.push(is_read === 'true' ? 1 : 0);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const notifications = db.prepare(query).all(...params) as Notification[];

  const unreadCount = (db.prepare(`
    SELECT COUNT(*) as count FROM notifications 
    WHERE user_id = ? AND is_read = 0
  `).get(req.user.id) as { count: number }).count;

  const countQuery = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?' + 
    (type && type !== 'all' ? ' AND type = ?' : '') +
    (is_read !== undefined && is_read !== 'all' ? ' AND is_read = ?' : '');
  const countParams: any[] = [req.user.id];
  if (type && type !== 'all') countParams.push(type);
  if (is_read !== undefined && is_read !== 'all') countParams.push(is_read === 'true' ? 1 : 0);
  const total = (db.prepare(countQuery).get(...countParams) as { count: number }).count;

  res.json({
    list: notifications,
    total,
    unread_count: unreadCount,
    page: Number(page),
    pageSize: Number(pageSize),
  });
});

router.get('/unread-count', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const count = (db.prepare(`
    SELECT COUNT(*) as count FROM notifications 
    WHERE user_id = ? AND is_read = 0
  `).get(req.user.id) as { count: number }).count;

  res.json({ count });
});

router.put('/:id/read', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) as Notification | undefined;
  
  if (!notification) {
    return res.status(404).json({ error: '通知不存在' });
  }

  if (notification.user_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作此通知' });
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: '已读' });
});

router.put('/read-all', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ message: '全部已读' });
});

export default router;
