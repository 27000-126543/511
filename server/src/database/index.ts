import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'instruments.db');

let database: Database | null = null;

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(__dirname, '../../node_modules/sql.js/dist', file),
  });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    database = new SQL.Database(fileBuffer);
  } else {
    database = new SQL.Database();
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      group_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS research_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      leader_id TEXT,
      budget REAL NOT NULL DEFAULT 0,
      budget_used REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instruments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      model TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      hourly_rate REAL NOT NULL DEFAULT 0,
      maintenance_cycle_days INTEGER NOT NULL DEFAULT 30,
      last_maintenance_date TEXT,
      description TEXT,
      image_url TEXT,
      current_temperature REAL,
      temperature_min REAL,
      temperature_max REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      instrument_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      actual_start_time TEXT,
      actual_end_time TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      purpose TEXT,
      priority INTEGER NOT NULL DEFAULT 1,
      cost REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instrument_status (
      id TEXT PRIMARY KEY,
      instrument_id TEXT NOT NULL,
      temperature REAL,
      status TEXT NOT NULL DEFAULT 'normal',
      timestamp TEXT NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS budget_records (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      reservation_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_plans (
      id TEXT PRIMARY KEY,
      instrument_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      interval_days INTEGER NOT NULL,
      last_maintenance_date TEXT,
      next_maintenance_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      instrument_id TEXT NOT NULL,
      plan_id TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      engineer_id TEXT,
      description TEXT,
      report_content TEXT,
      scheduled_date TEXT NOT NULL,
      completed_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS engineers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      location TEXT,
      qualification_level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      related_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      group_id TEXT,
      total_usage_hours REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      fault_count INTEGER NOT NULL DEFAULT 0,
      utilization_rate REAL NOT NULL DEFAULT 0,
      instrument_stats TEXT,
      created_at TEXT NOT NULL
    );
  `);

  saveDatabase();
  console.log('Database initialized successfully');
  return database;
}

export function saveDatabase() {
  if (!database) return;
  const data = database.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function getDb(): Database {
  if (!database) {
    throw new Error('Database not initialized');
  }
  return database;
}

export const db = {
  prepare: (sql: string) => {
    return {
      get: (...params: any[]): any => {
        if (!database) throw new Error('Database not initialized');
        const stmt = database.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const result = stmt.getAsObject();
          stmt.free();
          return result;
        }
        stmt.free();
        return undefined;
      },
      all: (...params: any[]): any[] => {
        if (!database) throw new Error('Database not initialized');
        const results: any[] = [];
        const stmt = database.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
      run: (...params: any[]): void => {
        if (!database) throw new Error('Database not initialized');
        const stmt = database.prepare(sql);
        stmt.run(params);
        stmt.free();
        saveDatabase();
      },
    };
  },
  exec: (sql: string): void => {
    if (!database) throw new Error('Database not initialized');
    database.run(sql);
    saveDatabase();
  },
  pragma: (): void => {},
};
