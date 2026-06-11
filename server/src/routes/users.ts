import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import bcrypt from 'bcryptjs';
import { db } from '../database';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { User, ResearchGroup } from '../types';

const router = Router();

router.get('/', authMiddleware, requireRole('instrument_admin', 'institute_leader'), (req, res) => {
  const { role, group_id, keyword } = req.query;

  let query = 'SELECT id, username, name, role, email, phone, group_id, created_at FROM users WHERE 1=1';
  const params: any[] = [];

  if (role && role !== 'all') {
    query += ' AND role = ?';
    params.push(role);
  }
  if (group_id) {
    query += ' AND group_id = ?';
    params.push(group_id);
  }
  if (keyword) {
    query += ' AND (name LIKE ? OR username LIKE ? OR email LIKE ?)';
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern);
  }

  query += ' ORDER BY created_at DESC';

  const users = db.prepare(query).all(...params) as User[];
  res.json(users);
});

router.get('/:id', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, name, role, email, phone, group_id, created_at FROM users WHERE id = ?').get(req.params.id) as User | undefined;
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  res.json(user);
});

router.post('/', authMiddleware, requireRole('institute_leader', 'instrument_admin'), (req, res) => {
  const { username, password, name, role, email, phone, group_id } = req.body;

  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: '请填写必填信息' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const id = uuidv4();
  const hashedPassword = bcrypt.hashSync(password, 10);
  const createdAt = dayjs().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (id, username, password, name, role, email, phone, group_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, username, hashedPassword, name, role, email || '', phone || '', group_id || null, createdAt);

  const newUser = db.prepare('SELECT id, username, name, role, email, phone, group_id, created_at FROM users WHERE id = ?').get(id) as User;
  res.status(201).json(newUser);
});

router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, email, phone, role, group_id, priority } = req.body;

  if (req.user?.id !== id && req.user?.role !== 'institute_leader' && req.user?.role !== 'instrument_admin' && req.user?.role !== 'group_leader') {
    return res.status(403).json({ error: '无权修改此用户' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  if (!existing) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const stmt = db.prepare(`
    UPDATE users SET name = ?, email = ?, phone = ?, role = ?, group_id = ? WHERE id = ?
  `);
  stmt.run(
    name || existing.name,
    email !== undefined ? email : existing.email,
    phone !== undefined ? phone : existing.phone,
    role || existing.role,
    group_id !== undefined ? group_id : existing.group_id,
    id
  );

  const updated = db.prepare('SELECT id, username, name, role, email, phone, group_id, created_at FROM users WHERE id = ?').get(id) as User;
  res.json(updated);
});

router.delete('/:id', authMiddleware, requireRole('institute_leader'), (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as User | undefined;
  if (!existing) {
    return res.status(404).json({ error: '用户不存在' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

router.put('/:id/priority', authMiddleware, requireRole('group_leader'), (req: AuthRequest, res) => {
  if (!req.user?.group_id) {
    return res.status(400).json({ error: '您不属于任何课题组' });
  }

  const { priority } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as User | undefined;

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (user.group_id !== req.user.group_id) {
    return res.status(403).json({ error: '该用户不属于您的课题组' });
  }

  if (priority < 1 || priority > 10) {
    return res.status(400).json({ error: '优先级范围为1-10' });
  }

  db.prepare('UPDATE reservations SET priority = ? WHERE user_id = ? AND status IN (?, ?)').run(
    priority, req.params.id, 'pending', 'confirmed'
  );

  res.json({ message: '优先级设置成功', priority });
});

router.get('/group/members', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user?.group_id) {
    return res.status(400).json({ error: '用户不属于任何课题组' });
  }

  const members = db.prepare(`
    SELECT id, username, name, role, email, phone, created_at 
    FROM users 
    WHERE group_id = ?
    ORDER BY role, name
  `).all(req.user.group_id) as User[];

  res.json(members);
});

router.post('/groups', authMiddleware, requireRole('institute_leader'), (req, res) => {
  const { name, budget, leader_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: '课题组名称不能为空' });
  }

  const id = uuidv4();
  const createdAt = dayjs().toISOString();

  const stmt = db.prepare(`
    INSERT INTO research_groups (id, name, leader_id, budget, budget_used, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `);
  stmt.run(id, name, leader_id || null, budget || 0, createdAt);

  if (leader_id) {
    db.prepare('UPDATE users SET group_id = ? WHERE id = ?').run(id, leader_id);
  }

  const newGroup = db.prepare('SELECT * FROM research_groups WHERE id = ?').get(id) as ResearchGroup;
  res.status(201).json(newGroup);
});

router.get('/groups/list', authMiddleware, (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, u.name as leader_name
    FROM research_groups g
    LEFT JOIN users u ON g.leader_id = u.id
    ORDER BY g.name
  `).all() as Array<ResearchGroup & { leader_name?: string }>;
  res.json(groups);
});

export default router;
