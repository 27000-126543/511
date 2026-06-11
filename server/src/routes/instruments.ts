import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../database';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { Instrument } from '../types';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const { type, status, keyword } = req.query;
  
  let query = 'SELECT i.*, u.name as admin_name FROM instruments i LEFT JOIN users u ON i.admin_id = u.id WHERE 1=1';
  const params: any[] = [];

  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }
  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    query += ' AND (name LIKE ? OR model LIKE ? OR location LIKE ?)';
    const keywordPattern = `%${keyword}%`;
    params.push(keywordPattern, keywordPattern, keywordPattern);
  }

  query += ' ORDER BY created_at DESC';

  const instruments = db.prepare(query).all(...params) as (Instrument & { admin_name?: string })[];
  res.json(instruments);
});

router.get('/types', authMiddleware, (req, res) => {
  const types = db.prepare('SELECT DISTINCT type FROM instruments').all() as { type: string }[];
  res.json(types.map(t => t.type));
});

router.get('/:id', authMiddleware, (req, res) => {
  const instrument = db.prepare('SELECT i.*, u.name as admin_name, u.email as admin_email, u.phone as admin_phone, u.role as admin_role FROM instruments i LEFT JOIN users u ON i.admin_id = u.id WHERE i.id = ?').get(req.params.id) as Instrument | undefined;
  
  if (!instrument) {
    return res.status(404).json({ error: '仪器不存在' });
  }

  res.json(instrument);
});

router.post('/', authMiddleware, requireRole('instrument_admin', 'institute_leader'), (req: AuthRequest, res) => {
  const { name, type, model, location, hourly_rate, maintenance_cycle_days, description, temperature_min, temperature_max, admin_id } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: '仪器名称和类型不能为空' });
  }

  const id = uuidv4();
  const createdAt = dayjs().toISOString();

  const stmt = db.prepare(`
    INSERT INTO instruments (id, name, type, model, location, status, hourly_rate, maintenance_cycle_days, description, temperature_min, temperature_max, admin_id, current_temperature, created_at)
    VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, name, type, model || '', location || '', hourly_rate || 0, maintenance_cycle_days || 30, description || '', temperature_min || 15, temperature_max || 30, admin_id || null, 22, createdAt);

  const newInstrument = db.prepare('SELECT i.*, u.name as admin_name, u.email as admin_email, u.phone as admin_phone, u.role as admin_role FROM instruments i LEFT JOIN users u ON i.admin_id = u.id WHERE i.id = ?').get(id) as Instrument;
  res.status(201).json(newInstrument);
});

router.put('/:id', authMiddleware, requireRole('instrument_admin', 'institute_leader'), (req: AuthRequest, res) => {
  const { name, type, model, location, status, hourly_rate, maintenance_cycle_days, description, temperature_min, temperature_max, admin_id } = req.body;

  const existing = db.prepare('SELECT i.*, u.name as admin_name, u.email as admin_email, u.phone as admin_phone, u.role as admin_role FROM instruments i LEFT JOIN users u ON i.admin_id = u.id WHERE i.id = ?').get(req.params.id) as Instrument | undefined;
  if (!existing) {
    return res.status(404).json({ error: '仪器不存在' });
  }

  const stmt = db.prepare(`
    UPDATE instruments SET 
      name = ?, type = ?, model = ?, location = ?, status = ?, 
      hourly_rate = ?, maintenance_cycle_days = ?, description = ?,
      temperature_min = ?, temperature_max = ?, admin_id = ?
    WHERE id = ?
  `);

  stmt.run(
    name || existing.name,
    type || existing.type,
    model !== undefined ? model : existing.model,
    location !== undefined ? location : existing.location,
    status || existing.status,
    hourly_rate !== undefined ? hourly_rate : existing.hourly_rate,
    maintenance_cycle_days !== undefined ? maintenance_cycle_days : existing.maintenance_cycle_days,
    description !== undefined ? description : existing.description,
    temperature_min !== undefined ? temperature_min : existing.temperature_min,
    temperature_max !== undefined ? temperature_max : existing.temperature_max,
    admin_id !== undefined ? admin_id : existing.admin_id,
    req.params.id
  );

  const updated = db.prepare('SELECT i.*, u.name as admin_name, u.email as admin_email, u.phone as admin_phone, u.role as admin_role FROM instruments i LEFT JOIN users u ON i.admin_id = u.id WHERE i.id = ?').get(req.params.id) as Instrument;
  res.json(updated);
});

router.delete('/:id', authMiddleware, requireRole('instrument_admin', 'institute_leader'), (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT i.*, u.name as admin_name, u.email as admin_email, u.phone as admin_phone, u.role as admin_role FROM instruments i LEFT JOIN users u ON i.admin_id = u.id WHERE i.id = ?').get(req.params.id) as Instrument | undefined;
  if (!existing) {
    return res.status(404).json({ error: '仪器不存在' });
  }

  db.prepare('DELETE FROM instruments WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

export default router;
