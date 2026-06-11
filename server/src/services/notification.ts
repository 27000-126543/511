import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../database';
import { Server } from 'socket.io';

let io: Server | null = null;

export function setNotificationSocket(socketIo: Server) {
  io = socketIo;
}

export function createNotification(
  userId: string,
  type: 'reservation' | 'warning' | 'work_order' | 'budget' | 'report' | 'system',
  title: string,
  content: string,
  relatedId?: string
) {
  const id = uuidv4();
  const createdAt = dayjs().toISOString();

  const stmt = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, related_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `);
  stmt.run(id, userId, type, title, content, relatedId || null, createdAt);

  if (io) {
    io.to(`user:${userId}`).emit('notification', {
      id,
      user_id: userId,
      type,
      title,
      content,
      related_id: relatedId,
      is_read: false,
      created_at: createdAt,
    });
  }

  return id;
}

export function broadcastNotification(
  userIds: string[],
  type: 'reservation' | 'warning' | 'work_order' | 'budget' | 'report' | 'system',
  title: string,
  content: string,
  relatedId?: string
) {
  userIds.forEach(userId => {
    createNotification(userId, type, title, content, relatedId);
  });
}
