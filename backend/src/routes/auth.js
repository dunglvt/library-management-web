const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { getPool } = require('../db/pool');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const authRouter = express.Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });
  const { username, password } = schema.parse(req.body);

  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, username, password_hash, role FROM users WHERE username = :username LIMIT 1',
    { username }
  );

  const user = rows[0];
  if (!user) return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });

  // --- SỬA Ở ĐÂY: SO SÁNH TRỰC TIẾP CHỮ THƯỜNG ---
  // Không dùng bcrypt.compare nữa để bạn gõ thẳng admin123 vào SQL là được
  const ok = (password === user.password_hash);

  if (!ok) return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

module.exports = { authRouter };