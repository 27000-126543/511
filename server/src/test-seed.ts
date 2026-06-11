import { initDatabase, db } from './database';
import { seedDatabase } from './database/seed';

async function test() {
  try {
    console.log('Testing init...');
    await initDatabase();
    console.log('Testing seed...');
    await seedDatabase();
    console.log('Seed completed!');
    
    const users = db.prepare('SELECT * FROM users').all();
    console.log('Users:', users.length);
    
    const instruments = db.prepare('SELECT * FROM instruments').all();
    console.log('Instruments:', instruments.length);
    
    const reservations = db.prepare('SELECT * FROM reservations').all();
    console.log('Reservations:', reservations.length);
  } catch (error) {
    console.error('Seed failed:', error);
  }
}

test();
