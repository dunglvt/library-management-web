const express = require('express');
const { getPool } = require('../db/pool');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const statsRouter = express.Router();
statsRouter.use(requireAuth);
statsRouter.use(requireRole('MANAGER'));

function parseDateOrThrow(v, name) {
  if (!v) throw Object.assign(new Error(`Thiếu ${name}`), { status: 400 });
  const s = v.toString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Object.assign(new Error(`Khoảng thời gian không hợp lệ!`), { status: 400 });
  return s;
}

statsRouter.get('/books', asyncHandler(async (req, res) => {
  const from = parseDateOrThrow(req.query.from, 'from');
  const to = parseDateOrThrow(req.query.to, 'to');
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT bt.id AS title_id, bt.code AS title_code, bt.title, bt.author, COUNT(*) AS borrow_count
     FROM borrow_items bi
     JOIN borrow_receipts br ON br.id = bi.receipt_id
     JOIN book_copies bc ON bc.id = bi.copy_id
     JOIN book_titles bt ON bt.id = bc.title_id
     WHERE br.borrow_date BETWEEN :from AND :to
     GROUP BY bt.id
     ORDER BY borrow_count DESC, bt.title ASC
     LIMIT 200`,
    { from, to }
  );
  res.json({ data: rows });
}));

// Chi tiết những lần mượn của 1 đầu sách trong khoảng thời gian
statsRouter.get('/books/:title_id/borrows', asyncHandler(async (req, res) => {
  const title_id = Number(req.params.title_id);
  const from = parseDateOrThrow(req.query.from, 'from');
  const to = parseDateOrThrow(req.query.to, 'to');
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT br.id AS receipt_id, br.borrow_date,
            r.name AS reader_name, r.code AS reader_code,
            bi.return_date, bi.total_fee,
            bc.barcode AS copy_barcode
     FROM borrow_items bi
     JOIN borrow_receipts br ON br.id = bi.receipt_id
     JOIN readers r ON r.id = br.reader_id
     JOIN book_copies bc ON bc.id = bi.copy_id
     WHERE bc.title_id = :title_id AND br.borrow_date BETWEEN :from AND :to
     ORDER BY br.borrow_date DESC
     LIMIT 500`,
    { title_id, from, to }
  );

  const [[title]] = await pool.query('SELECT id, code, title, author FROM book_titles WHERE id=:title_id', { title_id });
  res.json({ title, data: rows });
}));

statsRouter.get('/readers', asyncHandler(async (req, res) => {
  const from = parseDateOrThrow(req.query.from, 'from');
  const to = parseDateOrThrow(req.query.to, 'to');
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT r.id AS reader_id, r.code, r.name, r.phone, COUNT(*) AS borrow_count
     FROM borrow_items bi
     JOIN borrow_receipts br ON br.id = bi.receipt_id
     JOIN readers r ON r.id = br.reader_id
     WHERE br.borrow_date BETWEEN :from AND :to
     GROUP BY r.id
     ORDER BY borrow_count DESC, r.name ASC
     LIMIT 200`,
    { from, to }
  );
  res.json({ data: rows });
}));

// Chi tiết phiếu mượn (receipt) - danh sách sách trong phiếu
statsRouter.get('/receipts/:receipt_id', asyncHandler(async (req, res) => {
  const receipt_id = Number(req.params.receipt_id);
  const pool = getPool();

  const [[receipt]] = await pool.query(
    `SELECT br.*, r.name AS reader_name, r.code AS reader_code, u.username AS librarian_username
     FROM borrow_receipts br
     JOIN readers r ON r.id = br.reader_id
     JOIN users u ON u.id = br.librarian_id
     WHERE br.id=:receipt_id`,
    { receipt_id }
  );
  if (!receipt) return res.status(404).json({ message: 'Không tìm thấy phiếu mượn' });

  const [items] = await pool.query(
    `SELECT bi.id AS borrow_item_id, bc.barcode AS copy_barcode,
            bt.code AS title_code, bt.title, bt.author,
            bi.due_date, bi.return_date, bi.total_fee
     FROM borrow_items bi
     JOIN book_copies bc ON bc.id = bi.copy_id
     JOIN book_titles bt ON bt.id = bc.title_id
     WHERE bi.receipt_id=:receipt_id
     ORDER BY bi.id ASC`,
    { receipt_id }
  );

  res.json({ receipt, items });
}));

module.exports = { statsRouter };

// THÊM ĐOẠN NÀY VÀO CUỐI FILE (trước module.exports)
statsRouter.get('/revenue', asyncHandler(async (req, res) => {
  const from = parseDateOrThrow(req.query.from, 'from');
  const to = parseDateOrThrow(req.query.to, 'to');
  const pool = getPool();

  // 1. Tính tổng tiền
  const [[totalRow]] = await pool.query(
    `SELECT SUM(total_fee) AS total_revenue, SUM(late_fee) as total_late, SUM(damage_fee) as total_damage
     FROM borrow_items 
     WHERE return_date BETWEEN :from AND :to`,
    { from, to }
  );

  // 2. Lấy danh sách chi tiết các phiếu có phạt
  const [details] = await pool.query(
    `SELECT bi.return_date, bi.total_fee, bi.late_fee, bi.damage_fee,
            r.code as reader_code, r.name as reader_name,
            bc.barcode as book_barcode
     FROM borrow_items bi
     JOIN borrow_receipts br ON br.id = bi.receipt_id
     JOIN readers r ON r.id = br.reader_id
     JOIN book_copies bc ON bc.id = bi.copy_id
     WHERE bi.return_date BETWEEN :from AND :to AND bi.total_fee > 0
     ORDER BY bi.return_date DESC
     LIMIT 500`,
    { from, to }
  );

  res.json({
    summary: totalRow || { total_revenue: 0, total_late: 0, total_damage: 0 },
    details
  });
}));
