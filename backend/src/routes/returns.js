const express = require('express');
const { z } = require('zod');
const { getPool } = require('../db/pool');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const returnsRouter = express.Router();
returnsRouter.use(requireAuth);
returnsRouter.use(requireRole('LIBRARIAN', 'MANAGER'));

// HÀM HELPER: Xóa giờ, phút, giây để so sánh CHỈ so sánh ngày
function stripTime(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
}

// Scan a book to return
returnsRouter.post('/scan', asyncHandler(async (req, res) => {
  const schema = z.object({
    reader_id: z.number().int(),
    copy_barcode: z.string().min(1),
    return_date: z.string().optional(),
  });
  const { reader_id, copy_barcode, return_date } = schema.parse(req.body);
  const pool = getPool();

  const [[item]] = await pool.query(
    `SELECT bi.id AS borrow_item_id, bi.due_date, br.borrow_date,
            bc.id AS copy_id, bc.barcode AS copy_barcode,
            bt.title, bt.author, bt.cover_price
     FROM borrow_items bi
     JOIN borrow_receipts br ON br.id = bi.receipt_id
     JOIN book_copies bc ON bc.id = bi.copy_id
     JOIN book_titles bt ON bt.id = bc.title_id
     WHERE br.reader_id=:reader_id AND bc.barcode=:copy_barcode AND bi.return_date IS NULL
     ORDER BY br.borrow_date DESC
     LIMIT 1`,
    { reader_id, copy_barcode }
  );
  if (!item) return res.status(404).json({ message: 'Không tìm thấy sách đang mượn để trả (kiểm tra barcode/độc giả)' });

  // SỬA Ở ĐÂY: Chuẩn hóa lại ngày để so sánh
  const rdStr = return_date ? new Date(return_date) : new Date();
  const rd = stripTime(rdStr); // Ngày trả thực tế
  const due = stripTime(new Date(item.due_date)); // Hạn trả trong DB

  let late_fee = 0;
  // Tính số ngày trễ (1 ngày = 86400000 ms)
  const diffTime = rd.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    // Nếu trễ thì phạt 20% giá bìa (Hoặc bạn có thể nhân với số ngày trễ tùy ý)
    late_fee = Math.round(0.2 * Number(item.cover_price || 0));
  }

  res.json({
    borrow_item_id: item.borrow_item_id,
    copy_id: item.copy_id,
    copy_barcode: item.copy_barcode,
    title: item.title,
    author: item.author,
    borrow_date: item.borrow_date,
    due_date: item.due_date,
    late_fee,
    cover_price: Number(item.cover_price || 0),
  });
}));

// Confirm return
returnsRouter.post('/confirm', asyncHandler(async (req, res) => {
  const schema = z.object({
    borrow_item_id: z.number().int(),
    return_date: z.string().optional(),
    damages: z.array(z.object({
      damage_type_id: z.number().int(),
      fee: z.number().nonnegative(),
    })).default([]),
    late_fee_override: z.number().nonnegative().optional(),
  });
  const { borrow_item_id, return_date, damages, late_fee_override } = schema.parse(req.body);
  const pool = getPool();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[item]] = await conn.query(
      `SELECT bi.id, bi.due_date, bi.return_date, bc.id AS copy_id, bt.cover_price
       FROM borrow_items bi
       JOIN book_copies bc ON bc.id = bi.copy_id
       JOIN book_titles bt ON bt.id = bc.title_id
       WHERE bi.id=? FOR UPDATE`,
      [borrow_item_id]
    );
    if (!item) return res.status(404).json({ message: 'Không tìm thấy bản ghi mượn' });
    if (item.return_date) return res.status(400).json({ message: 'Sách này đã được trả trước đó' });

    // SỬA Ở ĐÂY TƯƠNG TỰ BÊN TRÊN
    const rdStr = return_date ? new Date(return_date) : new Date();
    const rd = stripTime(rdStr);
    const due = stripTime(new Date(item.due_date));

    let late_fee = 0;
    const diffTime = rd.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) late_fee = Math.round(0.2 * Number(item.cover_price || 0));
    if (typeof late_fee_override === 'number') late_fee = Math.round(late_fee_override);

    // damage fees
    let damage_fee = 0;
    for (const d of damages) damage_fee += Number(d.fee || 0);
    damage_fee = Math.round(damage_fee);

    const total_fee = late_fee + damage_fee;

    // Lưu lại return_date vào DB
    // Vì DB đang dùng múi giờ chuẩn, ta format lại bằng offset nội bộ để tránh lệch ngày
    const localDateStr = new Date(rd.getTime() - (rd.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    await conn.query(
      `UPDATE borrow_items
       SET return_date=?, late_fee=?, damage_fee=?, total_fee=?
       WHERE id=?`,
      [localDateStr, late_fee, damage_fee, total_fee, borrow_item_id]
    );

    await conn.query('DELETE FROM borrow_item_damages WHERE borrow_item_id=?', [borrow_item_id]);
    for (const d of damages) {
      await conn.query(
        `INSERT INTO borrow_item_damages(borrow_item_id, damage_type_id, fee)
         VALUES(?,?,?)`,
        [borrow_item_id, d.damage_type_id, d.fee]
      );
    }

    await conn.query(`UPDATE book_copies SET status='AVAILABLE' WHERE id=?`, [item.copy_id]);

    await conn.commit();
    res.json({ message: 'Trả sách thành công', late_fee, damage_fee, total_fee });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

returnsRouter.get('/item/:borrow_item_id/damages', asyncHandler(async (req, res) => {
  const borrow_item_id = Number(req.params.borrow_item_id);
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT bid.*, dt.name
     FROM borrow_item_damages bid
     JOIN damage_types dt ON dt.id = bid.damage_type_id
     WHERE bid.borrow_item_id=:borrow_item_id`,
    { borrow_item_id }
  );
  res.json({ data: rows });
}));

module.exports = { returnsRouter };