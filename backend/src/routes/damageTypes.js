const express = require('express');
const { z } = require('zod');
const { getPool } = require('../db/pool');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const damageTypesRouter = express.Router();
damageTypesRouter.use(requireAuth);

// Ai cũng xem được để hiển thị lúc trả sách
damageTypesRouter.get('/', asyncHandler(async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM damage_types ORDER BY id ASC');
  res.json({ data: rows });
}));

// CHỈ QUẢN LÝ MỚI ĐƯỢC THÊM/SỬA (Đã sửa chỗ này)
damageTypesRouter.post('/', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1), default_fee: z.number().nonnegative().default(0) });
  const data = schema.parse(req.body);
  const pool = getPool();
  await pool.query('INSERT INTO damage_types(name, default_fee) VALUES(:name,:default_fee)', data);
  res.json({ message: 'Đã thêm lỗi hỏng' });
}));

// CHỈ QUẢN LÝ MỚI ĐƯỢC SỬA (Đã sửa chỗ này)
damageTypesRouter.put('/:id', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ name: z.string().min(1), default_fee: z.number().nonnegative().default(0) });
  const data = schema.parse(req.body);
  const pool = getPool();
  await pool.query('UPDATE damage_types SET name=:name, default_fee=:default_fee WHERE id=:id', { ...data, id });
  res.json({ message: 'Đã cập nhật lỗi hỏng' });
}));

damageTypesRouter.delete('/:id', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  await pool.query('DELETE FROM damage_types WHERE id=:id', { id });
  res.json({ message: 'Đã xóa lỗi hỏng' });
}));

module.exports = { damageTypesRouter };