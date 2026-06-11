import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../database';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { MaintenancePlan, WorkOrder, Engineer, Instrument } from '../types';
import { createNotification, broadcastNotification } from '../services/notification';

const router = Router();

router.get('/plans', authMiddleware, (req, res) => {
  const { instrument_id, is_active } = req.query;

  let query = 'SELECT * FROM maintenance_plans WHERE 1=1';
  const params: any[] = [];

  if (instrument_id) {
    query += ' AND instrument_id = ?';
    params.push(instrument_id);
  }
  if (is_active !== undefined) {
    query += ' AND is_active = ?';
    params.push(is_active === 'true' ? 1 : 0);
  }

  query += ' ORDER BY next_maintenance_date ASC';

  const plans = db.prepare(query).all(...params) as MaintenancePlan[];
  
  const enriched = plans.map(p => {
    const instrument = db.prepare('SELECT id, name, location FROM instruments WHERE id = ?').get(p.instrument_id);
    return { ...p, instrument };
  });

  res.json(enriched);
});

router.post('/plans', authMiddleware, requireRole('instrument_admin'), (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const { instrument_id, name, description, interval_days, start_date } = req.body;

  if (!instrument_id || !name || !interval_days) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const id = uuidv4();
  const nextDate = start_date ? dayjs(start_date) : dayjs().add(interval_days, 'day');
  const createdAt = dayjs().toISOString();

  const stmt = db.prepare(`
    INSERT INTO maintenance_plans (id, instrument_id, name, description, interval_days, next_maintenance_date, created_by, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  stmt.run(id, instrument_id, name, description || '', interval_days, nextDate.toISOString(), req.user.id, createdAt);

  const instrument = db.prepare('SELECT name FROM instruments WHERE id = ?').get(instrument_id) as Instrument;
  createNotification(
    req.user.id,
    'system',
    '维护计划创建成功',
    `已为${instrument.name}创建维护计划：${name}`,
    id
  );

  const newPlan = db.prepare('SELECT * FROM maintenance_plans WHERE id = ?').get(id) as MaintenancePlan;
  res.status(201).json(newPlan);
});

router.put('/plans/:id', authMiddleware, requireRole('instrument_admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, description, interval_days, next_maintenance_date, is_active } = req.body;

  const plan = db.prepare('SELECT * FROM maintenance_plans WHERE id = ?').get(id) as MaintenancePlan | undefined;
  if (!plan) {
    return res.status(404).json({ error: '维护计划不存在' });
  }

  const stmt = db.prepare(`
    UPDATE maintenance_plans SET 
      name = ?, description = ?, interval_days = ?, 
      next_maintenance_date = ?, is_active = ?
    WHERE id = ?
  `);
  stmt.run(
    name || plan.name,
    description !== undefined ? description : plan.description,
    interval_days || plan.interval_days,
    next_maintenance_date || plan.next_maintenance_date,
    is_active !== undefined ? (is_active ? 1 : 0) : plan.is_active ? 1 : 0,
    id
  );

  const updated = db.prepare('SELECT * FROM maintenance_plans WHERE id = ?').get(id) as MaintenancePlan;
  res.json(updated);
});

router.get('/orders', authMiddleware, (req: AuthRequest, res) => {
  const { status, type, engineer_id, instrument_id } = req.query;

  let query = 'SELECT * FROM work_orders WHERE 1=1';
  const params: any[] = [];

  if (req.user?.role === 'engineer') {
    query += ' AND engineer_id = ?';
    params.push(req.user.id);
  }

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }
  if (engineer_id) {
    query += ' AND engineer_id = ?';
    params.push(engineer_id);
  }
  if (instrument_id) {
    query += ' AND instrument_id = ?';
    params.push(instrument_id);
  }

  query += ' ORDER BY created_at DESC';

  const orders = db.prepare(query).all(...params) as WorkOrder[];

  const enriched = orders.map(o => {
    const instrument = db.prepare('SELECT id, name, location FROM instruments WHERE id = ?').get(o.instrument_id);
    const engineer = o.engineer_id ? db.prepare('SELECT id, name, phone FROM engineers WHERE id = ?').get(o.engineer_id) : null;
    return { ...o, instrument, engineer };
  });

  res.json(enriched);
});

router.get('/orders/:id', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id) as WorkOrder | undefined;
  
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  const instrument = db.prepare('SELECT id, name, location, type FROM instruments WHERE id = ?').get(order.instrument_id);
  const engineer = order.engineer_id ? db.prepare('SELECT * FROM engineers WHERE id = ?').get(order.engineer_id) : null;

  res.json({ ...order, instrument, engineer });
});

router.post('/orders', authMiddleware, requireRole('instrument_admin'), (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const { instrument_id, type, priority, description, scheduled_date, auto_assign } = req.body;

  if (!instrument_id || !type || !scheduled_date) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const id = uuidv4();
  const createdAt = dayjs().toISOString();

  let engineerId = null;
  if (auto_assign) {
    const instrument = db.prepare('SELECT * FROM instruments WHERE id = ?').get(instrument_id) as Instrument;
    const engineers = db.prepare(`
      SELECT e.* FROM engineers e
      WHERE e.status = 'available'
      ORDER BY e.qualification_level DESC
    `).all() as Engineer[];

    if (engineers.length > 0) {
      engineerId = engineers[0].id;
    }
  }

  const stmt = db.prepare(`
    INSERT INTO work_orders (id, instrument_id, type, status, priority, engineer_id, description, scheduled_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, instrument_id, type, engineerId ? 'assigned' : 'pending', priority || 'medium', engineerId, description || '', scheduled_date, createdAt);

  const instrument = db.prepare('SELECT name FROM instruments WHERE id = ?').get(instrument_id) as Instrument;
  
  if (engineerId) {
    const engineer = db.prepare('SELECT name, phone FROM engineers WHERE id = ?').get(engineerId) as Engineer;
    createNotification(
      engineerId,
      'work_order',
      '新工单指派',
      `您收到新的工单：${instrument.name}${description ? ' - ' + description : ''}`,
      id
    );
  }

  const newOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrder;
  res.status(201).json(newOrder);
});

router.post('/orders/:id/assign', authMiddleware, requireRole('instrument_admin'), (req, res) => {
  const { id } = req.params;
  const { engineer_id } = req.body;

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrder | undefined;
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  const engineer = db.prepare('SELECT * FROM engineers WHERE id = ?').get(engineer_id) as Engineer | undefined;
  if (!engineer) {
    return res.status(400).json({ error: '工程师不存在' });
  }

  db.prepare("UPDATE work_orders SET status = 'assigned', engineer_id = ? WHERE id = ?").run(engineer_id, id);

  const instrument = db.prepare('SELECT name FROM instruments WHERE id = ?').get(order.instrument_id) as Instrument;
  createNotification(
    engineer_id,
    'work_order',
    '工单指派通知',
    `您被指派处理${instrument.name}的维修工单`,
    id
  );

  const updated = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrder;
  res.json(updated);
});

router.post('/orders/:id/start', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id) as WorkOrder | undefined;
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  if (req.user.role === 'engineer' && order.engineer_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作此工单' });
  }

  if (order.status !== 'assigned') {
    return res.status(400).json({ error: '当前状态不可开始' });
  }

  db.prepare("UPDATE work_orders SET status = 'in_progress' WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE instruments SET status = 'maintenance' WHERE id = ?").run(order.instrument_id);

  const updated = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id) as WorkOrder;
  res.json(updated);
});

router.post('/orders/:id/complete', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const { report_content } = req.body;
  const order = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id) as WorkOrder | undefined;
  
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  if (req.user.role === 'engineer' && order.engineer_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作此工单' });
  }

  if (order.status !== 'in_progress') {
    return res.status(400).json({ error: '当前状态不可完成' });
  }

  const now = dayjs().toISOString();
  db.prepare(`
    UPDATE work_orders SET status = 'completed', report_content = ?, completed_date = ? 
    WHERE id = ?
  `).run(report_content || '', now, req.params.id);

  db.prepare("UPDATE instruments SET status = 'available' WHERE id = ?").run(order.instrument_id);

  if (order.plan_id) {
    const plan = db.prepare('SELECT * FROM maintenance_plans WHERE id = ?').get(order.plan_id) as MaintenancePlan | undefined;
    if (plan) {
      const nextDate = dayjs(now).add(plan.interval_days, 'day');
      db.prepare(`
        UPDATE maintenance_plans 
        SET last_maintenance_date = ?, next_maintenance_date = ?
        WHERE id = ?
      `).run(now, nextDate.toISOString(), plan.id);
    }
  }

  db.prepare("UPDATE instruments SET last_maintenance_date = ? WHERE id = ?").run(now, order.instrument_id);

  const instrument = db.prepare('SELECT name FROM instruments WHERE id = ?').get(order.instrument_id) as Instrument;
  const adminUsers = db.prepare("SELECT id FROM users WHERE role = 'instrument_admin'").all() as { id: string }[];
  broadcastNotification(
    adminUsers.map(u => u.id),
    'work_order',
    '工单完成通知',
    `${instrument.name}的维修工单已完成`,
    order.id
  );

  const updated = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(req.params.id) as WorkOrder;
  res.json(updated);
});

router.get('/engineers', authMiddleware, (req, res) => {
  const { specialty, status } = req.query;

  let query = 'SELECT * FROM engineers WHERE 1=1';
  const params: any[] = [];

  if (specialty) {
    query += ' AND specialty LIKE ?';
    params.push(`%${specialty}%`);
  }
  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY qualification_level DESC';

  const engineers = db.prepare(query).all(...params) as Engineer[];
  res.json(engineers);
});

router.post('/engineers', authMiddleware, requireRole('instrument_admin'), (req, res) => {
  const { name, specialty, phone, email, location, qualification_level } = req.body;

  if (!name) {
    return res.status(400).json({ error: '工程师姓名不能为空' });
  }

  const id = uuidv4();
  const createdAt = dayjs().toISOString();

  const stmt = db.prepare(`
    INSERT INTO engineers (id, name, specialty, phone, email, status, location, qualification_level, created_at)
    VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?)
  `);
  stmt.run(id, name, specialty || '', phone || '', email || '', location || '', qualification_level || 1, createdAt);

  const newEngineer = db.prepare('SELECT * FROM engineers WHERE id = ?').get(id) as Engineer;
  res.status(201).json(newEngineer);
});

export function checkMaintenanceDue() {
  const threeDaysLater = dayjs().add(3, 'day').endOf('day').toISOString();
  const now = dayjs().toISOString();

  const plans = db.prepare(`
    SELECT mp.*, i.name as instrument_name, i.type as instrument_type
    FROM maintenance_plans mp
    JOIN instruments i ON mp.instrument_id = i.id
    WHERE mp.is_active = 1 
    AND mp.next_maintenance_date <= ?
    AND mp.next_maintenance_date >= ?
    AND NOT EXISTS (
      SELECT 1 FROM work_orders wo 
      WHERE wo.plan_id = mp.id 
      AND wo.status IN ('pending', 'assigned', 'in_progress')
    )
  `).all(threeDaysLater, now) as (MaintenancePlan & { instrument_name: string; instrument_type: string })[];

  plans.forEach(plan => {
    const engineers = db.prepare(`
      SELECT * FROM engineers 
      WHERE status = 'available'
      ORDER BY qualification_level DESC
      LIMIT 1
    `).all() as Engineer[];

    const engineerId = engineers.length > 0 ? engineers[0].id : null;

    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO work_orders (id, instrument_id, plan_id, type, status, priority, engineer_id, description, scheduled_date, created_at)
      VALUES (?, ?, ?, 'maintenance', ?, 'medium', ?, ?, ?, ?)
    `).run(
      orderId,
      plan.instrument_id,
      plan.id,
      engineerId ? 'assigned' : 'pending',
      engineerId,
      `定期维护：${plan.name}`,
      plan.next_maintenance_date,
      now
    );

    if (engineerId) {
      createNotification(
        engineerId,
        'work_order',
        '新维护工单',
        `您收到新的维护工单：${plan.instrument_name} - ${plan.name}`,
        orderId
      );
    }

    const adminUsers = db.prepare("SELECT id FROM users WHERE role = 'instrument_admin'").all() as { id: string }[];
    broadcastNotification(
      adminUsers.map(u => u.id),
      'work_order',
      '维护工单自动生成',
      `系统自动生成${plan.instrument_name}的维护工单`,
      orderId
    );
  });

  return plans.length;
}

export default router;
