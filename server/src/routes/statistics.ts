import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../database';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { createNotification, broadcastNotification } from '../services/notification';
import { Reservation, MonthlyReport, ResearchGroup, Instrument } from '../types';

const router = Router();

router.get('/group/usage', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user?.group_id) {
    return res.status(400).json({ error: '用户不属于任何课题组' });
  }

  const { month = dayjs().format('YYYY-MM') } = req.query;
  const monthStart = dayjs(month as string).startOf('month').toISOString();
  const monthEnd = dayjs(month as string).endOf('month').toISOString();

  const reservations = db.prepare(`
    SELECT r.*, i.name as instrument_name, i.type as instrument_type, u.name as user_name
    FROM reservations r
    JOIN instruments i ON r.instrument_id = i.id
    JOIN users u ON r.user_id = u.id
    WHERE r.group_id = ? 
    AND r.status IN ('completed', 'in_progress')
    AND r.start_time >= ? AND r.start_time <= ?
    ORDER BY r.start_time DESC
  `).all(req.user.group_id, monthStart, monthEnd) as Array<Reservation & { instrument_name: string; instrument_type: string; user_name: string }>;

  const userUsage: Record<string, { user_id: string; user_name: string; hours: number; cost: number }> = {};
  const instrumentUsage: Record<string, { instrument_id: string; instrument_name: string; hours: number; cost: number }> = {};

  let totalHours = 0;
  let totalCost = 0;

  reservations.forEach(r => {
    const start = dayjs(r.actual_start_time || r.start_time);
    const end = r.actual_end_time ? dayjs(r.actual_end_time) : (r.status === 'completed' ? dayjs(r.end_time) : dayjs());
    const hours = Math.max(0, end.diff(start, 'hour', true));
    const cost = r.cost || (hours * 0);

    totalHours += hours;
    totalCost += cost;

    if (!userUsage[r.user_id]) {
      userUsage[r.user_id] = { user_id: r.user_id, user_name: r.user_name, hours: 0, cost: 0 };
    }
    userUsage[r.user_id].hours += hours;
    userUsage[r.user_id].cost += cost;

    if (!instrumentUsage[r.instrument_id]) {
      instrumentUsage[r.instrument_id] = { instrument_id: r.instrument_id, instrument_name: r.instrument_name, hours: 0, cost: 0 };
    }
    instrumentUsage[r.instrument_id].hours += hours;
    instrumentUsage[r.instrument_id].cost += cost;
  });

  const userRanking = Object.values(userUsage).sort((a, b) => b.hours - a.hours);
  const instrumentPie = Object.values(instrumentUsage).sort((a, b) => b.cost - a.cost);

  res.json({
    month,
    total_hours: Math.round(totalHours * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    reservation_count: reservations.length,
    user_ranking: userRanking.map(u => ({
      ...u,
      hours: Math.round(u.hours * 100) / 100,
      cost: Math.round(u.cost * 100) / 100,
    })),
    instrument_pie: instrumentPie.map(i => ({
      ...i,
      hours: Math.round(i.hours * 100) / 100,
      cost: Math.round(i.cost * 100) / 100,
    })),
  });
});

router.get('/institute/summary', authMiddleware, requireRole('institute_leader', 'instrument_admin'), (req, res) => {
  const { month = dayjs().format('YYYY-MM') } = req.query;
  const monthStart = dayjs(month as string).startOf('month').toISOString();
  const monthEnd = dayjs(month as string).endOf('month').toISOString();

  const totalReservations = (db.prepare(`
    SELECT COUNT(*) as count FROM reservations 
    WHERE start_time >= ? AND start_time <= ?
    AND status IN ('completed', 'in_progress', 'confirmed')
  `).get(monthStart, monthEnd) as { count: number }).count;

  const totalUsage = db.prepare(`
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN actual_end_time IS NOT NULL THEN (JULIANDAY(actual_end_time) - JULIANDAY(actual_start_time)) * 24
          WHEN status = 'completed' THEN (JULIANDAY(end_time) - JULIANDAY(start_time)) * 24
          ELSE 0
        END
      ), 0) as total_hours,
      COALESCE(SUM(CASE WHEN cost IS NOT NULL THEN cost ELSE 0 END), 0) as total_cost
    FROM reservations
    WHERE start_time >= ? AND start_time <= ?
    AND status IN ('completed', 'in_progress')
  `).get(monthStart, monthEnd) as { total_hours: number; total_cost: number };

  const faultCount = (db.prepare(`
    SELECT COUNT(*) as count FROM work_orders
    WHERE type = 'repair' OR type = 'emergency'
    AND created_at >= ? AND created_at <= ?
  `).get(monthStart, monthEnd) as { count: number }).count;

  const instrumentCount = (db.prepare('SELECT COUNT(*) as count FROM instruments').get() as { count: number }).count;
  const groupCount = (db.prepare('SELECT COUNT(*) as count FROM research_groups').get() as { count: number }).count;
  const userCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'researcher'").get() as { count: number }).count;

  const instrumentStats = db.prepare(`
    SELECT 
      i.id, i.name, i.type, i.hourly_rate,
      COALESCE(SUM(
        CASE 
          WHEN r.actual_end_time IS NOT NULL THEN (JULIANDAY(r.actual_end_time) - JULIANDAY(r.actual_start_time)) * 24
          WHEN r.status = 'completed' THEN (JULIANDAY(r.end_time) - JULIANDAY(r.start_time)) * 24
          ELSE 0
        END
      ), 0) as usage_hours,
      COALESCE(SUM(CASE WHEN r.cost IS NOT NULL THEN r.cost ELSE 0 END), 0) as revenue,
      i.status
    FROM instruments i
    LEFT JOIN reservations r ON i.id = r.instrument_id 
      AND r.start_time >= ? AND r.start_time <= ?
      AND r.status IN ('completed', 'in_progress')
    GROUP BY i.id
    ORDER BY usage_hours DESC
  `).all(monthStart, monthEnd) as Array<{
    id: string; name: string; type: string; hourly_rate: number;
    usage_hours: number; revenue: number; status: string;
  }>;

  const groupStats = db.prepare(`
    SELECT 
      g.id, g.name, g.budget, g.budget_used,
      COALESCE(SUM(
        CASE 
          WHEN r.actual_end_time IS NOT NULL THEN (JULIANDAY(r.actual_end_time) - JULIANDAY(r.actual_start_time)) * 24
          WHEN r.status = 'completed' THEN (JULIANDAY(r.end_time) - JULIANDAY(r.start_time)) * 24
          ELSE 0
        END
      ), 0) as usage_hours,
      COALESCE(SUM(CASE WHEN r.cost IS NOT NULL THEN r.cost ELSE 0 END), 0) as total_cost,
      COUNT(r.id) as reservation_count
    FROM research_groups g
    LEFT JOIN reservations r ON g.id = r.group_id 
      AND r.start_time >= ? AND r.start_time <= ?
      AND r.status IN ('completed', 'in_progress')
    GROUP BY g.id
    ORDER BY total_cost DESC
  `).all(monthStart, monthEnd) as Array<{
    id: string; name: string; budget: number; budget_used: number;
    usage_hours: number; total_cost: number; reservation_count: number;
  }>;

  res.json({
    month,
    overview: {
      total_reservations: totalReservations,
      total_usage_hours: Math.round(totalUsage.total_hours * 100) / 100,
      total_revenue: Math.round(totalUsage.total_cost * 100) / 100,
      fault_count: faultCount,
      instrument_count: instrumentCount,
      group_count: groupCount,
      user_count: userCount,
    },
    instrument_stats: instrumentStats.map(s => ({
      ...s,
      usage_hours: Math.round(s.usage_hours * 100) / 100,
      revenue: Math.round(s.revenue * 100) / 100,
      utilization_rate: Math.round((s.usage_hours / (22 * 8)) * 10000) / 100,
    })),
    group_stats: groupStats.map(s => ({
      ...s,
      usage_hours: Math.round(s.usage_hours * 100) / 100,
      total_cost: Math.round(s.total_cost * 100) / 100,
      budget_remaining: s.budget - s.budget_used,
      budget_percent: s.budget > 0 ? Math.round(((s.budget - s.budget_used) / s.budget) * 10000) / 100 : 0,
    })),
  });
});

router.get('/monthly-reports', authMiddleware, requireRole('institute_leader', 'instrument_admin'), (req, res) => {
  const reports = db.prepare('SELECT * FROM monthly_reports ORDER BY month DESC LIMIT 12').all() as MonthlyReport[];
  res.json(reports);
});

router.get('/monthly-reports/:id', authMiddleware, (req, res) => {
  const report = db.prepare('SELECT * FROM monthly_reports WHERE id = ?').get(req.params.id) as MonthlyReport | undefined;
  
  if (!report) {
    return res.status(404).json({ error: '报告不存在' });
  }

  res.json({
    ...report,
    instrument_stats: report.instrument_stats ? JSON.parse(report.instrument_stats as unknown as string) : [],
  });
});

export function generateMonthlyReport() {
  const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');
  const monthStart = dayjs(lastMonth).startOf('month').toISOString();
  const monthEnd = dayjs(lastMonth).endOf('month').toISOString();

  const existing = db.prepare('SELECT * FROM monthly_reports WHERE month = ? AND group_id IS NULL').get(lastMonth) as MonthlyReport | undefined;
  if (existing) {
    return existing;
  }

  const stats = db.prepare(`
    SELECT 
      i.id as instrument_id, i.name as instrument_name, i.type,
      COALESCE(SUM(
        CASE 
          WHEN r.actual_end_time IS NOT NULL THEN (JULIANDAY(r.actual_end_time) - JULIANDAY(r.actual_start_time)) * 24
          WHEN r.status = 'completed' THEN (JULIANDAY(r.end_time) - JULIANDAY(r.start_time)) * 24
          ELSE 0
        END
      ), 0) as usage_hours,
      COALESCE(SUM(CASE WHEN r.cost IS NOT NULL THEN r.cost ELSE 0 END), 0) as revenue,
      COUNT(DISTINCT wo.id) as fault_count
    FROM instruments i
    LEFT JOIN reservations r ON i.id = r.instrument_id 
      AND r.start_time >= ? AND r.start_time <= ?
      AND r.status IN ('completed', 'in_progress')
    LEFT JOIN work_orders wo ON i.id = wo.instrument_id
      AND wo.type IN ('repair', 'emergency')
      AND wo.created_at >= ? AND wo.created_at <= ?
    GROUP BY i.id
    ORDER BY usage_hours DESC
  `).all(monthStart, monthEnd, monthStart, monthEnd);

  const totalUsageHours = stats.reduce((sum: number, s: any) => sum + s.usage_hours, 0);
  const totalCost = stats.reduce((sum: number, s: any) => sum + s.revenue, 0);
  const totalFaults = stats.reduce((sum: number, s: any) => sum + s.fault_count, 0);
  const utilizationRate = totalUsageHours / (stats.length * 22 * 8) * 100;

  const id = uuidv4();
  const createdAt = dayjs().toISOString();

  db.prepare(`
    INSERT INTO monthly_reports (id, month, total_usage_hours, total_cost, fault_count, utilization_rate, instrument_stats, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, lastMonth, totalUsageHours, totalCost, totalFaults, utilizationRate, JSON.stringify(stats), createdAt);

  const adminUsers = db.prepare("SELECT id FROM users WHERE role IN ('instrument_admin', 'institute_leader')").all() as { id: string }[];
  broadcastNotification(
    adminUsers.map(u => u.id),
    'report',
    '月度报告已生成',
    `${lastMonth}月度统计报告已生成，请查看详情`,
    id
  );

  return { id, month: lastMonth };
}

export default router;
