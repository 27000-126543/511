import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../database';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { Reservation, Instrument, ResearchGroup, User } from '../types';
import { checkTimeConflict, recommendTimeSlots, calculateReservationCost } from '../services/reservation';
import { createNotification, broadcastNotification } from '../services/notification';

const router = Router();

router.get('/my', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const { status, page = 1, pageSize = 10 } = req.query;
  
  let query = 'SELECT * FROM reservations WHERE user_id = ?';
  const params: any[] = [req.user.id];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY start_time DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const reservations = db.prepare(query).all(...params) as Reservation[];
  
  const countQuery = 'SELECT COUNT(*) as count FROM reservations WHERE user_id = ?' + (status && status !== 'all' ? ' AND status = ?' : '');
  const countParams = status && status !== 'all' ? [req.user.id, status] : [req.user.id];
  const total = (db.prepare(countQuery).get(...countParams) as { count: number }).count;

  const enriched = reservations.map(r => {
    const instrument = db.prepare('SELECT id, name, type, location, hourly_rate FROM instruments WHERE id = ?').get(r.instrument_id);
    return { ...r, instrument };
  });

  res.json({ list: enriched, total, page: Number(page), pageSize: Number(pageSize) });
});

router.get('/instrument/:instrumentId', authMiddleware, (req, res) => {
  const { instrumentId } = req.params;
  const { start_date, end_date } = req.query;

  let query = 'SELECT r.*, u.name as user_name, g.name as group_name FROM reservations r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN research_groups g ON r.group_id = g.id WHERE r.instrument_id = ? AND r.status IN (\'confirmed\', \'in_progress\', \'pending\')';
  const params: any[] = [instrumentId];

  if (start_date) {
    query += ' AND start_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND end_time <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY start_time';

  const reservations = db.prepare(query).all(...params) as Reservation[];
  res.json(reservations);
});

router.get('/recommend/:instrumentId', authMiddleware, (req, res) => {
  const { instrumentId } = req.params;
  const { duration, start_from, days } = req.query;

  const durationHours = Number(duration) || 2;
  const daysNum = Number(days) || 7;

  const recommendations = recommendTimeSlots(
    instrumentId,
    durationHours,
    start_from as string | undefined,
    daysNum
  );

  res.json(recommendations);
});

router.get('/check-conflict', authMiddleware, (req, res) => {
  const { instrument_id, start_time, end_time, reservation_id } = req.query;

  if (!instrument_id || !start_time || !end_time) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const result = checkTimeConflict(
    instrument_id as string,
    start_time as string,
    end_time as string,
    reservation_id as string | undefined
  );

  res.json(result);
});

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const { instrument_id, start_time, end_time, purpose } = req.body;

  if (!instrument_id || !start_time || !end_time) {
    return res.status(400).json({ error: '请填写完整预约信息' });
  }

  const instrument = db.prepare('SELECT * FROM instruments WHERE id = ?').get(instrument_id) as Instrument | undefined;
  if (!instrument) {
    return res.status(404).json({ error: '仪器不存在' });
  }

  if (instrument.status === 'maintenance' || instrument.status === 'fault') {
    return res.status(400).json({ error: '当前仪器不可预约' });
  }

  const conflictResult = checkTimeConflict(instrument_id, start_time, end_time);
  if (conflictResult.hasConflict) {
    return res.status(409).json({ 
      error: '所选时段存在冲突',
      conflicts: conflictResult.conflictingReservations 
    });
  }

  const group = db.prepare('SELECT * FROM research_groups WHERE id = ?').get(req.user.group_id) as ResearchGroup | undefined;
  if (!group) {
    return res.status(400).json({ error: '用户不属于任何课题组' });
  }

  const start = dayjs(start_time);
  const end = dayjs(end_time);
  const hours = end.diff(start, 'hour', true);
  const estimatedCost = Math.round(hours * instrument.hourly_rate * 100) / 100;

  if (group.budget - group.budget_used < estimatedCost) {
    return res.status(400).json({ error: '课题组预算不足' });
  }

  const id = uuidv4();
  const createdAt = dayjs().toISOString();

  const stmt = db.prepare(`
    INSERT INTO reservations (id, instrument_id, user_id, group_id, start_time, end_time, status, purpose, priority, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, 1, ?)
  `);
  stmt.run(id, instrument_id, req.user.id, req.user.group_id, start_time, end_time, purpose || '', createdAt);

  createNotification(
    req.user.id,
    'reservation',
    '预约成功',
    `您已成功预约${instrument.name}，时间：${start.format('YYYY-MM-DD HH:mm')} - ${end.format('HH:mm')}`,
    id
  );

  const adminUsers = db.prepare("SELECT id FROM users WHERE role = 'instrument_admin'").all() as { id: string }[];
  broadcastNotification(
    adminUsers.map(u => u.id),
    'reservation',
    '新预约通知',
    `${req.user.name}预约了${instrument.name}`,
    id
  );

  const newReservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id) as Reservation;
  res.status(201).json({ ...newReservation, estimated_cost: estimatedCost });
});

router.post('/:id/check-in', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
  if (!reservation) {
    return res.status(404).json({ error: '预约不存在' });
  }

  if (reservation.user_id !== req.user.id && req.user.role !== 'instrument_admin') {
    return res.status(403).json({ error: '无权操作此预约' });
  }

  if (reservation.status !== 'confirmed') {
    return res.status(400).json({ error: '当前状态不可签到' });
  }

  const now = dayjs().toISOString();
  const stmt = db.prepare(`
    UPDATE reservations SET status = 'in_progress', actual_start_time = ? WHERE id = ?
  `);
  stmt.run(now, req.params.id);

  db.prepare("UPDATE instruments SET status = 'in_use' WHERE id = ?").run(reservation.instrument_id);

  const instrument = db.prepare('SELECT name FROM instruments WHERE id = ?').get(reservation.instrument_id) as Instrument;
  
  createNotification(
    req.user.id,
    'reservation',
    '签到成功',
    `您已开始使用${instrument.name}，请按规范操作`,
    reservation.id
  );

  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation;
  res.json(updated);
});

router.post('/:id/check-out', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
  if (!reservation) {
    return res.status(404).json({ error: '预约不存在' });
  }

  if (reservation.user_id !== req.user.id && req.user.role !== 'instrument_admin') {
    return res.status(403).json({ error: '无权操作此预约' });
  }

  if (reservation.status !== 'in_progress') {
    return res.status(400).json({ error: '当前状态不可签退' });
  }

  const now = dayjs().toISOString();
  const instrument = db.prepare('SELECT * FROM instruments WHERE id = ?').get(reservation.instrument_id) as Instrument;
  
  const actualStart = reservation.actual_start_time || reservation.start_time;
  const durationHours = Math.max(0.5, dayjs(now).diff(dayjs(actualStart), 'hour', true));
  const cost = Math.round(durationHours * instrument.hourly_rate * 100) / 100;

  const stmt = db.prepare(`
    UPDATE reservations SET status = 'completed', actual_end_time = ?, cost = ? WHERE id = ?
  `);
  stmt.run(now, cost, req.params.id);

  db.prepare("UPDATE instruments SET status = 'available' WHERE id = ?").run(reservation.instrument_id);

  const group = db.prepare('SELECT * FROM research_groups WHERE id = ?').get(reservation.group_id) as ResearchGroup;
  const newBudgetUsed = group.budget_used + cost;
  db.prepare('UPDATE research_groups SET budget_used = ? WHERE id = ?').run(newBudgetUsed, group.id);

  const budgetRecordId = uuidv4();
  db.prepare(`
    INSERT INTO budget_records (id, group_id, amount, type, description, reservation_id, created_at)
    VALUES (?, ?, ?, 'deduct', ?, ?, ?)
  `).run(budgetRecordId, group.id, cost, `使用${instrument.name}费用`, reservation.id, now);

  createNotification(
    req.user.id,
    'reservation',
    '使用结束',
    `您已结束使用${instrument.name}，费用：${cost}元，时长：${durationHours.toFixed(2)}小时`,
    reservation.id
  );

  const budgetRemaining = group.budget - newBudgetUsed;
  const budgetPercent = (budgetRemaining / group.budget) * 100;
  
  if (budgetPercent < 20 && group.leader_id) {
    createNotification(
      group.leader_id,
      'budget',
      '预算预警',
      `${group.name}预算余额已低于20%，剩余：${budgetRemaining.toFixed(2)}元`,
      group.id
    );
  }

  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation;
  res.json({ ...updated, cost, duration_hours: durationHours });
});

router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
  if (!reservation) {
    return res.status(404).json({ error: '预约不存在' });
  }

  if (reservation.user_id !== req.user.id && req.user.role !== 'instrument_admin' && req.user.role !== 'institute_leader') {
    return res.status(403).json({ error: '无权取消此预约' });
  }

  if (reservation.status === 'in_progress' || reservation.status === 'completed') {
    return res.status(400).json({ error: '当前状态不可取消' });
  }

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(req.params.id);

  const instrument = db.prepare('SELECT name FROM instruments WHERE id = ?').get(reservation.instrument_id) as Instrument;
  createNotification(
    req.user.id,
    'reservation',
    '预约已取消',
    `您已取消${instrument.name}的预约`,
    reservation.id
  );

  res.json({ message: '取消成功' });
});

router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as Reservation | undefined;
  
  if (!reservation) {
    return res.status(404).json({ error: '预约不存在' });
  }

  const instrument = db.prepare('SELECT id, name, type, model, location, hourly_rate FROM instruments WHERE id = ?').get(reservation.instrument_id);
  const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(reservation.user_id);
  const group = db.prepare('SELECT id, name FROM research_groups WHERE id = ?').get(reservation.group_id);

  res.json({
    ...reservation,
    instrument,
    user,
    group,
  });
});

export default router;
