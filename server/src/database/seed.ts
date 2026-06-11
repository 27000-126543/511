import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { db, initDatabase } from './index';

export async function seedDatabase() {
  await initDatabase();

  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  if (existingUsers && existingUsers.count > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database...');

  const hashPassword = (password: string) => bcrypt.hashSync(password, 10);

  const groups = [
    { id: uuidv4(), name: '纳米材料研究组', budget: 100000, budget_used: 15000 },
    { id: uuidv4(), name: '生物医学研究组', budget: 80000, budget_used: 25000 },
    { id: uuidv4(), name: '光电技术研究组', budget: 120000, budget_used: 8000 },
  ];

  const insertGroup = db.prepare(`
    INSERT INTO research_groups (id, name, leader_id, budget, budget_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  groups.forEach(group => {
    insertGroup.run(group.id, group.name, null, group.budget, group.budget_used, dayjs().toISOString());
  });

  const users = [
    { id: uuidv4(), username: 'admin', password: hashPassword('123456'), name: '系统管理员', role: 'instrument_admin', email: 'admin@institute.cn', phone: '13800000001', group_id: null },
    { id: uuidv4(), username: 'leader1', password: hashPassword('123456'), name: '张教授', role: 'group_leader', email: 'zhang@institute.cn', phone: '13800000002', group_id: groups[0].id },
    { id: uuidv4(), username: 'leader2', password: hashPassword('123456'), name: '李教授', role: 'group_leader', email: 'li@institute.cn', phone: '13800000003', group_id: groups[1].id },
    { id: uuidv4(), username: 'researcher1', password: hashPassword('123456'), name: '王研究员', role: 'researcher', email: 'wang@institute.cn', phone: '13800000004', group_id: groups[0].id },
    { id: uuidv4(), username: 'researcher2', password: hashPassword('123456'), name: '赵研究员', role: 'researcher', email: 'zhao@institute.cn', phone: '13800000005', group_id: groups[0].id },
    { id: uuidv4(), username: 'researcher3', password: hashPassword('123456'), name: '陈研究员', role: 'researcher', email: 'chen@institute.cn', phone: '13800000006', group_id: groups[1].id },
    { id: uuidv4(), username: 'institute_leader', password: hashPassword('123456'), name: '刘院长', role: 'institute_leader', email: 'liu@institute.cn', phone: '13800000007', group_id: null },
    { id: uuidv4(), username: 'engineer1', password: hashPassword('123456'), name: '孙工程师', role: 'engineer', email: 'sun@institute.cn', phone: '13800000008', group_id: null },
    { id: uuidv4(), username: 'engineer2', password: hashPassword('123456'), name: '周工程师', role: 'engineer', email: 'zhou@institute.cn', phone: '13800000009', group_id: null },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password, name, role, email, phone, group_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  users.forEach(user => {
    insertUser.run(user.id, user.username, user.password, user.name, user.role, user.email, user.phone, user.group_id, dayjs().toISOString());
  });

  const updateGroupLeader = db.prepare('UPDATE research_groups SET leader_id = ? WHERE id = ?');
  updateGroupLeader.run(users[1].id, groups[0].id);
  updateGroupLeader.run(users[2].id, groups[1].id);

  const instruments = [
    { id: uuidv4(), name: '高分辨透射电子显微镜', type: '电子显微镜', model: 'Tecnai G2 F20', location: 'A座101室', status: 'available', hourly_rate: 500, maintenance_cycle_days: 30, description: '用于材料微观结构表征，分辨率0.2nm', temperature_min: 15, temperature_max: 25, current_temperature: 20 },
    { id: uuidv4(), name: '场发射扫描电子显微镜', type: '电子显微镜', model: 'SU8010', location: 'A座102室', status: 'available', hourly_rate: 300, maintenance_cycle_days: 45, description: '用于表面形貌观察，分辨率1.0nm', temperature_min: 18, temperature_max: 26, current_temperature: 22 },
    { id: uuidv4(), name: 'X射线衍射仪', type: 'X射线分析', model: 'D8 Advance', location: 'B座201室', status: 'available', hourly_rate: 200, maintenance_cycle_days: 60, description: '用于晶体结构分析', temperature_min: 20, temperature_max: 28, current_temperature: 24 },
    { id: uuidv4(), name: '激光共聚焦显微镜', type: '光学显微镜', model: 'LSM900', location: 'B座202室', status: 'in_use', hourly_rate: 400, maintenance_cycle_days: 30, description: '用于生物样品荧光成像', temperature_min: 20, temperature_max: 25, current_temperature: 23 },
    { id: uuidv4(), name: '流式细胞仪', type: '细胞分析', model: 'FACSVerse', location: 'C座301室', status: 'available', hourly_rate: 350, maintenance_cycle_days: 20, description: '用于细胞分析与分选', temperature_min: 18, temperature_max: 28, current_temperature: 22 },
    { id: uuidv4(), name: '核磁共振波谱仪', type: '波谱分析', model: 'AVANCE III 400', location: 'C座302室', status: 'maintenance', hourly_rate: 600, maintenance_cycle_days: 90, description: '用于有机化合物结构鉴定', temperature_min: 18, temperature_max: 24, current_temperature: 21 },
    { id: uuidv4(), name: '紫外可见分光光度计', type: '光谱分析', model: 'Lambda 950', location: 'D座401室', status: 'available', hourly_rate: 100, maintenance_cycle_days: 90, description: '用于紫外-可见光谱分析', temperature_min: 15, temperature_max: 30, current_temperature: 25 },
    { id: uuidv4(), name: '热重分析仪', type: '热分析', model: 'TGA 8000', location: 'D座402室', status: 'available', hourly_rate: 250, maintenance_cycle_days: 60, description: '用于材料热稳定性分析', temperature_min: 15, temperature_max: 35, current_temperature: 26 },
  ];

  const insertInstrument = db.prepare(`
    INSERT INTO instruments (id, name, type, model, location, status, hourly_rate, maintenance_cycle_days, last_maintenance_date, description, temperature_min, temperature_max, current_temperature, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  instruments.forEach(inst => {
    insertInstrument.run(
      inst.id, inst.name, inst.type, inst.model, inst.location, inst.status,
      inst.hourly_rate, inst.maintenance_cycle_days, dayjs().subtract(15, 'day').toISOString(),
      inst.description, inst.temperature_min, inst.temperature_max, inst.current_temperature,
      dayjs().toISOString()
    );
  });

  const engineers = [
    { id: users[7].id, name: '孙工程师', specialty: '电子显微镜', phone: '13800000008', email: 'sun@institute.cn', status: 'available', location: 'A座', qualification_level: 3 },
    { id: users[8].id, name: '周工程师', specialty: '光学/光谱仪器', phone: '13800000009', email: 'zhou@institute.cn', status: 'available', location: 'B座', qualification_level: 2 },
  ];

  const insertEngineer = db.prepare(`
    INSERT INTO engineers (id, name, specialty, phone, email, status, location, qualification_level, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  engineers.forEach(eng => {
    insertEngineer.run(eng.id, eng.name, eng.specialty, eng.phone, eng.email, eng.status, eng.location, eng.qualification_level, dayjs().toISOString());
  });

  const reservations: Array<{
    id: string;
    instrument_id: string;
    user_id: string;
    group_id: string;
    start_time: string;
    end_time: string;
    actual_start_time: string | null;
    actual_end_time: string | null;
    status: string;
    purpose: string;
    priority: number;
    cost: number | null;
  }> = [
    { id: uuidv4(), instrument_id: instruments[3].id, user_id: users[5].id, group_id: groups[1].id, start_time: dayjs().subtract(1, 'hour').toISOString(), end_time: dayjs().add(2, 'hour').toISOString(), actual_start_time: dayjs().subtract(55, 'minute').toISOString(), actual_end_time: null, status: 'in_progress', purpose: '细胞成像实验', priority: 2, cost: null },
    { id: uuidv4(), instrument_id: instruments[0].id, user_id: users[3].id, group_id: groups[0].id, start_time: dayjs().add(1, 'day').hour(9).minute(0).second(0).toISOString(), end_time: dayjs().add(1, 'day').hour(12).minute(0).second(0).toISOString(), actual_start_time: null, actual_end_time: null, status: 'confirmed', purpose: '纳米材料表征', priority: 1, cost: null },
    { id: uuidv4(), instrument_id: instruments[2].id, user_id: users[4].id, group_id: groups[0].id, start_time: dayjs().add(2, 'day').hour(14).minute(0).second(0).toISOString(), end_time: dayjs().add(2, 'day').hour(17).minute(0).second(0).toISOString(), actual_start_time: null, actual_end_time: null, status: 'confirmed', purpose: '晶体结构分析', priority: 1, cost: null },
  ];

  const insertReservation = db.prepare(`
    INSERT INTO reservations (id, instrument_id, user_id, group_id, start_time, end_time, actual_start_time, actual_end_time, status, purpose, priority, cost, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  reservations.forEach(r => {
    insertReservation.run(r.id, r.instrument_id, r.user_id, r.group_id, r.start_time, r.end_time, r.actual_start_time, r.actual_end_time, r.status, r.purpose, r.priority, r.cost, dayjs().toISOString());
  });

  const maintenancePlans = [
    { id: uuidv4(), instrument_id: instruments[0].id, name: '月度常规维护', description: '电镜常规检查、真空系统维护、灯丝检查', interval_days: 30, last_maintenance_date: dayjs().subtract(15, 'day').toISOString(), next_maintenance_date: dayjs().add(15, 'day').toISOString(), created_by: users[0].id },
    { id: uuidv4(), instrument_id: instruments[5].id, name: '季度深度维护', description: '磁体检查、匀场校正、探头维护', interval_days: 90, last_maintenance_date: dayjs().subtract(30, 'day').toISOString(), next_maintenance_date: dayjs().add(60, 'day').toISOString(), created_by: users[0].id },
  ];

  const insertPlan = db.prepare(`
    INSERT INTO maintenance_plans (id, instrument_id, name, description, interval_days, last_maintenance_date, next_maintenance_date, created_by, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  maintenancePlans.forEach(p => {
    insertPlan.run(p.id, p.instrument_id, p.name, p.description, p.interval_days, p.last_maintenance_date, p.next_maintenance_date, p.created_by, dayjs().toISOString());
  });

  const workOrders = [
    { id: uuidv4(), instrument_id: instruments[5].id, plan_id: null, type: 'maintenance', status: 'in_progress', priority: 'medium', engineer_id: engineers[0].id, description: '核磁仪定期维护', scheduled_date: dayjs().toISOString() },
  ];

  const insertOrder = db.prepare(`
    INSERT INTO work_orders (id, instrument_id, plan_id, type, status, priority, engineer_id, description, scheduled_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  workOrders.forEach(o => {
    insertOrder.run(o.id, o.instrument_id, o.plan_id, o.type, o.status, o.priority, o.engineer_id, o.description, o.scheduled_date, dayjs().toISOString());
  });

  const notifications = [
    { id: uuidv4(), user_id: users[3].id, type: 'reservation', title: '预约成功', content: '您预约的高分辨透射电子显微镜已确认，请按时使用。', related_id: reservations[1].id },
    { id: uuidv4(), user_id: users[2].id, type: 'budget', title: '预算预警', content: '生物医学研究组预算余额已低于50%，请注意控制使用。', related_id: groups[1].id },
  ];

  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, related_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `);

  notifications.forEach(n => {
    insertNotification.run(n.id, n.user_id, n.type, n.title, n.content, n.related_id, dayjs().toISOString());
  });

  for (let i = 0; i < 30; i++) {
    const insertStatus = db.prepare(`
      INSERT INTO instrument_status (id, instrument_id, temperature, status, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertStatus.run(uuidv4(), instruments[0].id, 20 + Math.random() * 2, 'normal', dayjs().subtract(i * 30, 'minute').toISOString());
    insertStatus.run(uuidv4(), instruments[3].id, 23 + Math.random() * 1.5, 'normal', dayjs().subtract(i * 30, 'minute').toISOString());
  }

  console.log('Database seeded successfully!');
  console.log('默认账号:');
  console.log('  管理员: admin / 123456');
  console.log('  课题组长: leader1 / 123456');
  console.log('  研究员: researcher1 / 123456');
  console.log('  院领导: institute_leader / 123456');
  console.log('  工程师: engineer1 / 123456');
}

if (require.main === module) {
  seedDatabase().then(() => {
    console.log('Seed completed');
    process.exit(0);
  }).catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
