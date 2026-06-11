import dayjs from 'dayjs';
import { db } from '../database';
import { Reservation, Instrument, MaintenancePlan } from '../types';

export interface RecommendedSlot {
  start_time: string;
  end_time: string;
  score: number;
  reason: string;
}

export interface TimeSlot {
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
}

export function checkTimeConflict(
  instrumentId: string,
  startTime: string,
  endTime: string,
  excludeReservationId?: string
): { hasConflict: boolean; conflictingReservations: Reservation[] } {
  const start = dayjs(startTime);
  const end = dayjs(endTime);

  let query = `
    SELECT * FROM reservations 
    WHERE instrument_id = ? 
    AND status IN ('confirmed', 'in_progress', 'pending')
    AND (
      (start_time < ? AND end_time > ?) OR
      (start_time < ? AND end_time > ?) OR
      (start_time >= ? AND end_time <= ?)
    )
  `;
  
  const params: any[] = [instrumentId, end.toISOString(), start.toISOString(), end.toISOString(), start.toISOString(), start.toISOString(), end.toISOString()];

  if (excludeReservationId) {
    query += ' AND id != ?';
    params.push(excludeReservationId);
  }

  const reservations = db.prepare(query).all(...params) as Reservation[];

  return {
    hasConflict: reservations.length > 0,
    conflictingReservations: reservations,
  };
}

export function getMaintenanceSlots(instrumentId: string, startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): TimeSlot[] {
  const plans = db.prepare(`
    SELECT * FROM maintenance_plans 
    WHERE instrument_id = ? AND is_active = 1
  `).all(instrumentId) as MaintenancePlan[];

  const slots: TimeSlot[] = [];

  plans.forEach(plan => {
    let currentDate = dayjs(plan.next_maintenance_date);
    while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
      if (currentDate.isAfter(startDate) || currentDate.isSame(startDate, 'day')) {
        slots.push({
          start: currentDate.hour(9).minute(0),
          end: currentDate.hour(12).minute(0),
        });
      }
      currentDate = currentDate.add(plan.interval_days, 'day');
    }
  });

  return slots;
}

export function getOccupancyRate(instrumentId: string, days: number = 30): number {
  const startDate = dayjs().subtract(days, 'day').toISOString();
  const endDate = dayjs().toISOString();

  const reservations = db.prepare(`
    SELECT * FROM reservations 
    WHERE instrument_id = ? 
    AND status IN ('completed', 'in_progress', 'confirmed')
    AND start_time >= ? AND start_time <= ?
  `).all(instrumentId, startDate, endDate) as Reservation[];

  let totalHours = 0;
  reservations.forEach(r => {
    const start = dayjs(r.start_time);
    const end = dayjs(r.end_time);
    totalHours += end.diff(start, 'hour', true);
  });

  const workingHoursPerDay = 8;
  const maxHours = days * workingHoursPerDay;
  return Math.min(100, (totalHours / maxHours) * 100);
}

export function recommendTimeSlots(
  instrumentId: string,
  durationHours: number,
  startFrom?: string,
  days: number = 7
): RecommendedSlot[] {
  const instrument = db.prepare('SELECT * FROM instruments WHERE id = ?').get(instrumentId) as Instrument | undefined;
  if (!instrument) return [];

  const now = startFrom ? dayjs(startFrom) : dayjs();
  const endDate = now.add(days, 'day');

  const reservations = db.prepare(`
    SELECT * FROM reservations 
    WHERE instrument_id = ? 
    AND status IN ('confirmed', 'in_progress', 'pending')
    AND start_time >= ? AND start_time <= ?
    ORDER BY start_time
  `).all(instrumentId, now.toISOString(), endDate.toISOString()) as Reservation[];

  const maintenanceSlots = getMaintenanceSlots(instrumentId, now, endDate);
  const occupancyRate = getOccupancyRate(instrumentId, 30);

  const recommended: RecommendedSlot[] = [];
  const workingStart = 9;
  const workingEnd = 18;

  let currentTime = now.clone().startOf('hour');
  if (currentTime.hour() < workingStart) {
    currentTime = currentTime.hour(workingStart).minute(0);
  }

  while (currentTime.isBefore(endDate)) {
    if (currentTime.hour() >= workingStart && currentTime.hour() + durationHours <= workingEnd) {
      const slotStart = currentTime.clone();
      const slotEnd = currentTime.clone().add(durationHours, 'hour');

      const hasReservationConflict = reservations.some(r => {
        const rStart = dayjs(r.start_time);
        const rEnd = dayjs(r.end_time);
        return slotStart.isBefore(rEnd) && slotEnd.isAfter(rStart);
      });

      const hasMaintenanceConflict = maintenanceSlots.some(slot => 
        slotStart.isBefore(slot.end) && slotEnd.isAfter(slot.start)
      );

      if (!hasReservationConflict && !hasMaintenanceConflict && slotStart.isAfter(now)) {
        let score = 0;
        const reasons: string[] = [];

        const hourOfDay = slotStart.hour();
        if (hourOfDay >= 9 && hourOfDay < 12) {
          score += 40;
          reasons.push('上午时段仪器状态佳');
        } else if (hourOfDay >= 14 && hourOfDay < 17) {
          score += 30;
          reasons.push('下午时段利用率高');
        }

        const dayOfWeek = slotStart.day();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          score += 20;
        }

        if (occupancyRate > 70) {
          score += 15;
          reasons.push('近期预约紧张，建议尽早锁定');
        } else if (occupancyRate < 30) {
          score += 10;
          reasons.push('近期预约宽松，选择灵活');
        }

        const daysAhead = slotStart.diff(now, 'day');
        if (daysAhead < 2) {
          score += 15;
          reasons.push('近期可用，无需等待');
        }

        score = Math.min(100, score);

        recommended.push({
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          score,
          reason: reasons.join('；'),
        });
      }
    }

    currentTime = currentTime.add(30, 'minute');

    if (currentTime.hour() >= workingEnd) {
      currentTime = currentTime.add(1, 'day').hour(workingStart).minute(0);
    }
  }

  return recommended
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export function calculateReservationCost(reservation: Reservation, instrument: Instrument): number {
  const startTime = reservation.actual_start_time ? dayjs(reservation.actual_start_time) : dayjs(reservation.start_time);
  const endTime = reservation.actual_end_time ? dayjs(reservation.actual_end_time) : dayjs(reservation.end_time);
  
  const durationHours = Math.max(0.5, endTime.diff(startTime, 'hour', true));
  return Math.round(durationHours * instrument.hourly_rate * 100) / 100;
}
