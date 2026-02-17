const express = require('express');
const { z } = require('zod');
const { getPool } = require('../db/pool');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const readersRouter = express.Router();

readersRouter.use(requireAuth);

readersRouter.get('/', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const pool = getPool();
  let rows;
  if (q) {
    const [r] = await pool.query(
      `SELECT * FROM readers 
       WHERE code LIKE :q OR name LIKE :q OR barcode LIKE :q
       ORDER BY id DESC LIMIT 200`,
      { q: `%${q}%` }
    );
    rows = r;
  } else {
    const [r] = await pool.query('SELECT * FROM readers ORDER BY id DESC LIMIT 200');
    rows = r;
  }
  res.json({ data: rows });
}));

readersRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  const [[reader]] = await pool.query('SELECT * FROM readers WHERE id = :id', { id });
  if (!reader) return res.status(404).json({ message: 'Không tìm thấy độc giả' });

  // Borrowed (not returned)
  const [borrowed] = await pool.query(
    `SELECT bi.id AS borrow_item_id, bc.barcode AS copy_barcode, bt.title, bt.author,
            br.borrow_date, bi.due_date
     FROM borrow_items bi
     JOIN borrow_receipts br ON br.id = bi.receipt_id
     JOIN book_copies bc ON bc.id = bi.copy_id
     JOIN book_titles bt ON bt.id = bc.title_id
     WHERE br.reader_id = :id AND bi.return_date IS NULL
     ORDER BY br.borrow_date DESC`,
    { id }
  );

  // Returned history
  const [returned] = await pool.query(
    `SELECT bi.id AS borrow_item_id, bc.barcode AS copy_barcode, bt.title, bt.author,
            br.borrow_date, bi.due_date, bi.return_date, bi.late_fee, bi.damage_fee, bi.total_fee
     FROM borrow_items bi
     JOIN borrow_receipts br ON br.id = bi.receipt_id
     JOIN book_copies bc ON bc.id = bi.copy_id
     JOIN book_titles bt ON bt.id = bc.title_id
     WHERE br.reader_id = :id AND bi.return_date IS NOT NULL
     ORDER BY bi.return_date DESC
     LIMIT 200`,
    { id }
  );

  res.json({ reader, borrowed, returned });
}));

readersRouter.post('/', requireRole('LIBRARIAN', 'MANAGER'), asyncHandler(async (req, res) => {
  const schema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    dob: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    barcode: z.string().min(1),
  });
  const data = schema.parse(req.body);
  const pool = getPool();
  await pool.query(
    `INSERT INTO readers(code, name, dob, address, phone, barcode)
     VALUES(:code,:name,:dob,:address,:phone,:barcode)`,
    data
  );
  res.json({ message: 'Đã thêm độc giả' });
}));

readersRouter.put('/:id', requireRole('LIBRARIAN', 'MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    dob: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    barcode: z.string().min(1),
  });
  const data = schema.parse(req.body);
  const pool = getPool();
  await pool.query(
    `UPDATE readers SET code=:code, name=:name, dob=:dob, address=:address, phone=:phone, barcode=:barcode
     WHERE id=:id`,
    { ...data, id }
  );
  res.json({ message: 'Đã cập nhật độc giả' });
}));

readersRouter.delete('/:id', requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  await pool.query('DELETE FROM readers WHERE id=:id', { id });
  res.json({ message: 'Đã xóa độc giả' });
}));

module.exports = { readersRouter };
