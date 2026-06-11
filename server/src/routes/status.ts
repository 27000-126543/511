import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../database';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { InstrumentStatus, Instrument } from '../types';
import { createNotification, broadcastNotification } from '../services/notification';
import { Server } from 'socket.io';

let io: Server | null = null;

export function setStatusSocket(socketIo: Server) {
  io = socketIo;
}

const router = Router();

router.get('/instrument/:instrumentId/recent', authMiddleware, (req, res) => {
  const { instrumentId } = req.params;
  const { limit = 50 } = req.query;

  const statuses = db.prepare(`
    SELECT * FROM instrument_status 
    WHERE instrument_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ?
  `).all(instrumentId, Number(limit)) as InstrumentStatus[];

  res.json(statuses.reverse());
});

router.post('/instrument/:instrumentId', (req, res) => {
  const { instrumentId } = req.params;
  const { temperature, status, details } = req.body;

  const instrument = db.prepare('SELECT * FROM instruments WHERE id = ?').get(instrumentId) as Instrument | undefined;
  if (!instrument) {
    return res.status(404).json({ error: '仪器不存在' });
  }

  const id = uuidv4();
  const timestamp = dayjs().toISOString();

  const actualStatus = status || 'normal';
  let isAbnormal = false;

  if (temperature !== undefined) {
    if (instrument.temperature_min && temperature < instrument.temperature_min) {
      isAbnormal = true;
    }
    if (instrument.temperature_max && temperature > instrument.temperature_max) {
      isAbnormal = true;
    }
  }

  const finalStatus = isAbnormal ? 'warning' : actualStatus;

  const stmt = db.prepare(`
    INSERT INTO instrument_status (id, instrument_id, temperature, status, timestamp, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, instrumentId, temperature, finalStatus, timestamp, details || null);

  db.prepare('UPDATE instruments SET current_temperature = ? WHERE id = ?').run(temperature, instrumentId);

  if (isAbnormal && io) {
    io.to(`instrument:${instrumentId}`).emit('status-warning', {
      id,
      instrument_id: instrumentId,
      temperature,
      status: finalStatus,
      timestamp,
      details,
    });

    const adminUsers = db.prepare("SELECT id FROM users WHERE role = 'instrument_admin'").all() as { id: string }[];
    broadcastNotification(
      adminUsers.map(u => u.id),
      'warning',
      '仪器异常预警',
      `${instrument.name}温度异常，当前温度：${temperature}°C，请及时处理`,
      instrumentId
    );

    const activeReservation = db.prepare(`
      SELECT user_id FROM reservations 
      WHERE instrument_id = ? AND status = 'in_progress'
      LIMIT 1
    `).get(instrumentId) as { user_id: string } | undefined;

    if (activeReservation) {
      createNotification(
        activeReservation.user_id,
        'warning',
        '仪器异常预警',
        `您正在使用的${instrument.name}出现温度异常，请关注设备状态`,
        instrumentId
      );
    }
  }

  res.status(201).json({ id, instrument_id: instrumentId, temperature, status: finalStatus, timestamp });
});

router.get('/instrument/:instrumentId/statistics', authMiddleware, (req, res) => {
  const { instrumentId } = req.params;
  const { hours = 24 } = req.query;

  const startTime = dayjs().subtract(Number(hours), 'hour').toISOString();

  const statuses = db.prepare(`
    SELECT * FROM instrument_status 
    WHERE instrument_id = ? AND timestamp >= ?
    ORDER BY timestamp ASC
  `).all(instrumentId, startTime) as InstrumentStatus[];

  const temps = statuses.map(s => s.temperature).filter(t => t !== undefined) as number[];
  const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;
  const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;
  const minTemp = temps.length > 0 ? Math.min(...temps) : 0;

  const warningCount = statuses.filter(s => s.status !== 'normal').length;

  res.json({
    total_records: statuses.length,
    avg_temperature: Math.round(avgTemp * 100) / 100,
    max_temperature: maxTemp,
    min_temperature: minTemp,
    warning_count: warningCount,
    data: statuses,
  });
});

export default router;
