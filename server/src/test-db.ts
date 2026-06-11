import { initDatabase, db } from './database';

async function test() {
  try {
    console.log('Testing database init...');
    await initDatabase();
    console.log('Database initialized!');
    
    const users = db.prepare('SELECT * FROM users').all();
    console.log('Users count:', users.length);
    
    const instruments = db.prepare('SELECT * FROM instruments').all();
    console.log('Instruments count:', instruments.length);
    
    console.log('Test passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
