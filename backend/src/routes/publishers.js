const express = require('express');
const { z } = require('zod');
const { getPool } = require('../db/pool');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const publishersRouter = express.Router();
publishersRouter.use(requireAuth);

publishersRouter.get('/', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const pool = getPool();
  const [rows] = q
    ? await pool.query('SELECT * FROM publishers WHERE name LIKE :q ORDER BY id DESC LIMIT 200', { q: `%${q}%` })
    : await pool.query('SELECT * FROM publishers ORDER BY id DESC LIMIT 200');
  res.json({ data: rows });
}));

publishersRouter.post('/', requireRole('LIBRARIAN', 'MANAGER'), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const { name } = schema.parse(req.body);
  const pool = getPool();
  await pool.query('INSERT INTO publishers(name) VALUES(:name)', { name });
  res.json({ message: 'Đã thêm NXB' });
}));

publishersRouter.put('/:id', requireRole('LIBRARIAN', 'MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ name: z.string().min(1) });
  const { name } = schema.parse(req.body);
  const pool = getPool();
  await pool.query('UPDATE publishers SET name=:name WHERE id=:id', { name, id });
  res.json({ message: 'Đã cập nhật NXB' });
}));

publishersRouter.delete('/:id', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  await pool.query('DELETE FROM publishers WHERE id=:id', { id });
  res.json({ message: 'Đã xóa NXB' });
}));

module.exports = { publishersRouter };
