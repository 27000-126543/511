import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import dayjs from 'dayjs';
import { initDatabase } from './database';
import { seedDatabase } from './database/seed';
import { setNotificationSocket } from './services/notification';
import { setStatusSocket } from './routes/status';
import { checkMaintenanceDue } from './routes/maintenance';
import { generateMonthlyReport } from './routes/statistics';

import authRouter from './routes/auth';
import instrumentsRouter from './routes/instruments';
import reservationsRouter from './routes/reservations';
import statusRouter from './routes/status';
import budgetRouter from './routes/budget';
import maintenanceRouter from './routes/maintenance';
import statisticsRouter from './routes/statistics';
import notificationsRouter from './routes/notifications';
import usersRouter from './routes/users';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

async function startServer() {
  await initDatabase();
  await seedDatabase();

  setNotificationSocket(io);
  setStatusSocket(io);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined`);
    });

    socket.on('join-instrument', (instrumentId: string) => {
      socket.join(`instrument:${instrumentId}`);
      console.log(`Joined instrument ${instrumentId}`);
    });

    socket.on('leave-instrument', (instrumentId: string) => {
      socket.leave(`instrument:${instrumentId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/instruments', instrumentsRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/status', statusRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/maintenance', maintenanceRouter);
  app.use('/api/statistics', statisticsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/users', usersRouter);

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || '服务器内部错误' });
  });

  function runScheduledTasks() {
    console.log('Running scheduled tasks...');
    
    try {
      const maintenanceCount = checkMaintenanceDue();
      if (maintenanceCount > 0) {
        console.log(`Generated ${maintenanceCount} maintenance work orders`);
      }
    } catch (e) {
      console.error('Error in maintenance check:', e);
    }

    if (dayjs().date() === 1) {
      try {
        const report = generateMonthlyReport();
        console.log('Generated monthly report:', report.month);
      } catch (e) {
        console.error('Error in monthly report generation:', e);
      }
    }
  }

  setInterval(runScheduledTasks, 60 * 60 * 1000);

  setTimeout(runScheduledTasks, 5000);

  let statusSimulationInterval: NodeJS.Timeout | null = null;

  function startStatusSimulation() {
    if (statusSimulationInterval) return;

    statusSimulationInterval = setInterval(() => {
      const { db } = require('./database');
      const { v4: uuidv4 } = require('uuid');
      
      const instruments = db.prepare(
        "SELECT id, status, temperature_min, temperature_max, current_temperature FROM instruments WHERE status = 'in_use'"
      ).all() as Array<{ id: string; status: string; temperature_min?: number; temperature_max?: number; current_temperature?: number }>;

      instruments.forEach(inst => {
        if (inst.current_temperature !== undefined && inst.temperature_min !== undefined && inst.temperature_max !== undefined) {
          const baseTemp = (inst.temperature_min + inst.temperature_max) / 2;
          const variation = (Math.random() - 0.5) * 4;
          let newTemp = baseTemp + variation;

          if (Math.random() < 0.05) {
            newTemp = inst.temperature_max + Math.random() * 5;
          }

          newTemp = Math.round(newTemp * 10) / 10;

          const isNormal = newTemp >= inst.temperature_min && newTemp <= inst.temperature_max;

          db.prepare(`
            INSERT INTO instrument_status (id, instrument_id, temperature, status, timestamp)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            inst.id,
            newTemp,
            isNormal ? 'normal' : 'warning',
            new Date().toISOString()
          );

          db.prepare(
            'UPDATE instruments SET current_temperature = ? WHERE id = ?'
          ).run(newTemp, inst.id);

          if (!isNormal) {
            io.to(`instrument:${inst.id}`).emit('status-warning', {
              instrument_id: inst.id,
              temperature: newTemp,
              status: 'warning',
              timestamp: new Date().toISOString(),
            });
          } else {
            io.to(`instrument:${inst.id}`).emit('status-update', {
              instrument_id: inst.id,
              temperature: newTemp,
              status: 'normal',
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    }, 30000);

    console.log('Status simulation started (30s interval)');
  }

  setTimeout(startStatusSimulation, 10000);

  server.listen(PORT, () => {
    console.log(`
========================================
  仪器设备共享平台 - 后端服务
  服务地址: http://localhost:${PORT}
  WebSocket: ws://localhost:${PORT}
  启动时间: ${new Date().toLocaleString()}
========================================
    `);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
