import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../database';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { ResearchGroup, BudgetRecord } from '../types';
import { createNotification } from '../services/notification';

const router = Router();

router.get('/my-group', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user || !req.user.group_id) {
    return res.status(400).json({ error: '用户不属于任何课题组' });
  }

  const group = db.prepare('SELECT * FROM research_groups WHERE id = ?').get(req.user.group_id) as ResearchGroup | undefined;
  
  if (!group) {
    return res.status(404).json({ error: '课题组不存在' });
  }

  const remaining = group.budget - group.budget_used;
  const percent = group.budget > 0 ? (remaining / group.budget) * 100 : 0;

  res.json({
    ...group,
    budget_remaining: remaining,
    budget_percent: Math.round(percent * 100) / 100,
  });
});

router.get('/groups', authMiddleware, requireRole('institute_leader', 'instrument_admin'), (req, res) => {
  const groups = db.prepare('SELECT * FROM research_groups ORDER BY name').all() as ResearchGroup[];
  
  const enriched = groups.map(g => ({
    ...g,
    budget_remaining: g.budget - g.budget_used,
    budget_percent: g.budget > 0 ? Math.round(((g.budget - g.budget_used) / g.budget) * 10000) / 100 : 0,
  }));

  res.json(enriched);
});

router.get('/:groupId/records', authMiddleware, (req: AuthRequest, res) => {
  const { groupId } = req.params;
  const { type, page = 1, pageSize = 20 } = req.query;

  if (req.user?.role === 'researcher' && req.user.group_id !== groupId) {
    return res.status(403).json({ error: '无权查看其他课题组预算' });
  }

  let query = 'SELECT * FROM budget_records WHERE group_id = ?';
  const params: any[] = [groupId];

  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const records = db.prepare(query).all(...params) as BudgetRecord[];

  const countQuery = 'SELECT COUNT(*) as count FROM budget_records WHERE group_id = ?' + (type && type !== 'all' ? ' AND type = ?' : '');
  const countParams = type && type !== 'all' ? [groupId, type] : [groupId];
  const total = (db.prepare(countQuery).get(...countParams) as { count: number }).count;

  res.json({ list: records, total, page: Number(page), pageSize: Number(pageSize) });
});

router.post('/:groupId/recharge', authMiddleware, requireRole('institute_leader'), (req: AuthRequest, res) => {
  const { groupId } = req.params;
  const { amount, description } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: '充值金额必须大于0' });
  }

  const group = db.prepare('SELECT * FROM research_groups WHERE id = ?').get(groupId) as ResearchGroup | undefined;
  if (!group) {
    return res.status(404).json({ error: '课题组不存在' });
  }

  const newBudget = group.budget + amount;
  db.prepare('UPDATE research_groups SET budget = ? WHERE id = ?').run(newBudget, groupId);

  const recordId = uuidv4();
  db.prepare(`
    INSERT INTO budget_records (id, group_id, amount, type, description, created_at)
    VALUES (?, ?, ?, 'recharge', ?, ?)
  `).run(recordId, groupId, amount, description || '预算充值', dayjs().toISOString());

  if (group.leader_id) {
    createNotification(
      group.leader_id,
      'budget',
      '预算到账通知',
      `${group.name}获得预算充值：${amount}元，当前总预算：${newBudget}元`,
      groupId
    );
  }

  res.json({ message: '充值成功', new_budget: newBudget });
});

router.put('/:groupId/set-budget', authMiddleware, requireRole('institute_leader'), (req: AuthRequest, res) => {
  const { groupId } = req.params;
  const { budget } = req.body;

  if (budget === undefined || budget < 0) {
    return res.status(400).json({ error: '预算金额无效' });
  }

  const group = db.prepare('SELECT * FROM research_groups WHERE id = ?').get(groupId) as ResearchGroup | undefined;
  if (!group) {
    return res.status(404).json({ error: '课题组不存在' });
  }

  const diff = budget - group.budget;
  
  db.prepare('UPDATE research_groups SET budget = ? WHERE id = ?').run(budget, groupId);

  if (diff !== 0) {
    const recordId = uuidv4();
    db.prepare(`
      INSERT INTO budget_records (id, group_id, amount, type, description, created_at)
      VALUES (?, ?, ?, 'adjust', ?, ?)
    `).run(recordId, groupId, diff, diff > 0 ? '预算调整（增加）' : '预算调整（减少）', dayjs().toISOString());

    if (group.leader_id) {
      createNotification(
        group.leader_id,
        'budget',
        '预算调整通知',
        `${group.name}预算已调整为：${budget}元`,
        groupId
      );
    }
  }

  res.json({ message: '设置成功', budget });
});

export default router;
