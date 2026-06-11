import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../types';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken(user.id, user.role);
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    token,
    user: userWithoutPassword,
  });
});

router.get('/profile', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });
  const { password: _, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
});

router.put('/profile', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: '未授权' });
  
  const { name, email, phone } = req.body;
  
  const stmt = db.prepare(`
    UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?
  `);
  stmt.run(name || req.user.name, email || req.user.email, phone || req.user.phone, req.user.id);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as User;
  const { password: _, ...userWithoutPassword } = updatedUser;
  res.json(userWithoutPassword);
});

export default router;
