const express = require('express');
const { z } = require('zod');
const { getPool } = require('../db/pool');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const booksRouter = express.Router();
booksRouter.use(requireAuth);

// Book titles
booksRouter.get('/titles', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const pool = getPool();
  const [rows] = q
    ? await pool.query(
      `SELECT bt.*, p.name AS publisher_name
       FROM book_titles bt
       LEFT JOIN publishers p ON p.id = bt.publisher_id
       WHERE bt.code LIKE :q OR bt.title LIKE :q OR bt.author LIKE :q
       ORDER BY bt.id DESC LIMIT 200`,
      { q: `%${q}%` }
    )
    : await pool.query(
      `SELECT bt.*, p.name AS publisher_name
       FROM book_titles bt
       LEFT JOIN publishers p ON p.id = bt.publisher_id
       ORDER BY bt.id DESC LIMIT 200`
    );
  res.json({ data: rows });
}));

booksRouter.post('/titles', requireRole('LIBRARIAN', 'MANAGER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    code: z.string().min(1),
    title: z.string().min(1),
    author: z.string().min(1),
    publish_year: z.number().int().optional().nullable(),
    cover_price: z.number().nonnegative(),
    publisher_id: z.number().int().optional().nullable(),
    description: z.string().optional().nullable(),
  });
  const data = schema.parse(req.body);
  const pool = getPool();
  await pool.query(
    `INSERT INTO book_titles(code,title,author,publish_year,cover_price,publisher_id,description)
     VALUES(:code,:title,:author,:publish_year,:cover_price,:publisher_id,:description)`,
    data
  );
  res.json({ message: 'Đã thêm đầu sách' });
}));

booksRouter.put('/titles/:id', requireRole('LIBRARIAN', 'MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    code: z.string().min(1),
    title: z.string().min(1),
    author: z.string().min(1),
    publish_year: z.number().int().optional().nullable(),
    cover_price: z.number().nonnegative(),
    publisher_id: z.number().int().optional().nullable(),
    description: z.string().optional().nullable(),
  });
  const data = schema.parse(req.body);
  const pool = getPool();
  await pool.query(
    `UPDATE book_titles
     SET code=:code, title=:title, author=:author, publish_year=:publish_year, cover_price=:cover_price,
         publisher_id=:publisher_id, description=:description
     WHERE id=:id`,
    { ...data, id }
  );
  res.json({ message: 'Đã cập nhật đầu sách' });
}));

booksRouter.delete('/titles/:id', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  await pool.query('DELETE FROM book_titles WHERE id=:id', { id });
  res.json({ message: 'Đã xóa đầu sách' });
}));

// Book copies
booksRouter.get('/copies', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const pool = getPool();
  const sql = `
    SELECT bc.*, bt.title, bt.author, bt.code AS title_code
    FROM book_copies bc
    JOIN book_titles bt ON bt.id = bc.title_id
    WHERE (:q = '' OR bc.barcode LIKE :qLike OR bt.title LIKE :qLike OR bt.author LIKE :qLike)
    ORDER BY bc.id DESC LIMIT 300`;
  const [rows] = await pool.query(sql, { q: q, qLike: `%${q}%` });
  res.json({ data: rows });
}));

// --- SỬA ĐOẠN NÀY TRONG FILE books.js ---
booksRouter.post('/copies', requireRole('LIBRARIAN', 'MANAGER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    title_id: z.number().int(),
    // Sửa thành .optional() để không bắt buộc phải gửi barcode từ Frontend
    barcode: z.string().optional().nullable(),
  });

  const data = schema.parse(req.body);
  const pool = getPool();

  // Chúng ta vẫn INSERT barcode, nhưng nếu data.barcode trống, 
  // Database Trigger bạn đã viết sẽ tự động điền mã chuẩn vào.
  await pool.query(
    `INSERT INTO book_copies(title_id, barcode, status) VALUES(:title_id, :barcode, 'AVAILABLE')`,
    {
      title_id: data.title_id,
      barcode: data.barcode || null // Gửi null nếu không có để Trigger kích hoạt
    }
  );
  res.json({ message: 'Đã thêm quyển sách (Mã vạch tự động sinh)' });
}));

booksRouter.put('/copies/:id', requireRole('LIBRARIAN', 'MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    title_id: z.number().int(),
    barcode: z.string().min(1),
    status: z.enum(['AVAILABLE', 'BORROWED', 'LOST', 'DAMAGED']).default('AVAILABLE'),
  });
  const data = schema.parse(req.body);
  const pool = getPool();
  await pool.query(
    `UPDATE book_copies SET title_id=:title_id, barcode=:barcode, status=:status WHERE id=:id`,
    { ...data, id }
  );
  res.json({ message: 'Đã cập nhật quyển sách' });
}));

booksRouter.delete('/copies/:id', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  await pool.query('DELETE FROM book_copies WHERE id=:id', { id });
  res.json({ message: 'Đã xóa quyển sách' });
}));

module.exports = { booksRouter };
