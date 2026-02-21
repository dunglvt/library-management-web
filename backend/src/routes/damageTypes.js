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

// CHỈ QUẢN LÝ MỚI ĐƯỢC THÊM/SỬA
damageTypesRouter.post('/', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  try {
    // 1. Dịch câu báo lỗi của Zod ngay trong schema
    const schema = z.object({
      name: z.string().min(1, "Vui lòng nhập tên lỗi hỏng!"),
      default_fee: z.number().nonnegative("Phí phạt không được là số âm!").default(0)
    });

    const data = schema.parse(req.body);
    const pool = getPool();
    await pool.query('INSERT INTO damage_types(name, default_fee) VALUES(:name,:default_fee)', data);
    res.json({ message: 'Đã thêm lỗi hỏng thành công!' });

  } catch (error) {
    // 2. Bắt lỗi nhập số âm hoặc để trống từ Zod
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    // 3. Bắt lỗi trùng tên từ MySQL
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Tên lỗi hỏng này đã tồn tại!' });
    }
    // Lỗi hệ thống khác
    throw error;
  }
}));

// CHỈ QUẢN LÝ MỚI ĐƯỢC SỬA
damageTypesRouter.put('/:id', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      name: z.string().min(1, "Vui lòng nhập tên lỗi hỏng!"),
      default_fee: z.number().nonnegative("Phí phạt không được là số âm!").default(0)
    });

    const data = schema.parse(req.body);
    const pool = getPool();
    await pool.query('UPDATE damage_types SET name=:name, default_fee=:default_fee WHERE id=:id', { ...data, id });
    res.json({ message: 'Đã cập nhật lỗi hỏng thành công!' });

  } catch (error) {
    // Bắt lỗi tương tự như POST
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Tên lỗi hỏng này đã tồn tại!' });
    }
    throw error;
  }
}));

damageTypesRouter.delete('/:id', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  await pool.query('DELETE FROM damage_types WHERE id=:id', { id });
  res.json({ message: 'Đã xóa lỗi hỏng' });
}));

module.exports = { damageTypesRouter };