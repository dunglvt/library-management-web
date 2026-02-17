const express = require('express');
const { z } = require('zod');
const { getPool } = require('../db/pool');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const borrowRouter = express.Router();
borrowRouter.use(requireAuth);
borrowRouter.use(requireRole('LIBRARIAN', 'MANAGER'));

borrowRouter.post('/checkout', asyncHandler(async (req, res) => {
  const schema = z.object({
    reader_id: z.number().int(),
    copy_barcodes: z.array(z.string().min(1)).min(1).max(5),
    borrow_date: z.string().optional(), // YYYY-MM-DD
  });
  const { reader_id, copy_barcodes, borrow_date } = schema.parse(req.body);

  const pool = getPool();

  const [[reader]] = await pool.query('SELECT id, name, barcode FROM readers WHERE id=:reader_id', { reader_id });
  if (!reader) return res.status(404).json({ message: 'Không tìm thấy độc giả' });

  // count currently borrowed
  const [[cntRow]] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM borrow_items bi
     JOIN borrow_receipts br ON br.id = bi.receipt_id
     WHERE br.reader_id=:reader_id AND bi.return_date IS NULL`,
    { reader_id }
  );
  const currentlyBorrowed = Number(cntRow.cnt || 0);
  if (currentlyBorrowed >= 5) {
    return res.status(400).json({ message: 'Độc giả đang mượn đủ 5 cuốn, cần trả bớt trước khi mượn thêm.' });
  }
  if (currentlyBorrowed + copy_barcodes.length > 5) {
    return res.status(400).json({ message: `Vượt hạn mức 5 cuốn. Hiện đang mượn ${currentlyBorrowed} cuốn.` });
  }

  // Verify copies exist and available
  const [copies] = await pool.query(
    `SELECT bc.id, bc.barcode, bc.status, bt.cover_price
     FROM book_copies bc
     JOIN book_titles bt ON bt.id = bc.title_id
     WHERE bc.barcode IN (${copy_barcodes.map(() => '?').join(',')})`,
    copy_barcodes
  );
  if (copies.length !== copy_barcodes.length) {
    return res.status(400).json({ message: 'Có barcode sách không tồn tại trong hệ thống' });
  }
  const notAvailable = copies.filter(c => c.status !== 'AVAILABLE');
  if (notAvailable.length) {
    return res.status(400).json({ message: `Sách không sẵn sàng để mượn: ${notAvailable.map(x => x.barcode).join(', ')}` });
  }

  // Create receipt and items (transaction)
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const bd = borrow_date ? new Date(borrow_date + 'T00:00:00Z') : new Date();
    const borrowDateStr = bd.toISOString().slice(0, 10);
    const due = new Date(bd.getTime() + 120 * 24 * 3600 * 1000);
    // const due = new Date(bd.getTime() + 1 * 24 * 3600 * 1000);
    const dueStr = due.toISOString().slice(0, 10);

    const [r1] = await conn.query(
      `INSERT INTO borrow_receipts(reader_id, librarian_id, borrow_date) VALUES(?,?,?)`,
      [reader_id, req.user.id, borrowDateStr]
    );
    const receiptId = r1.insertId;

    for (const c of copies) {
      await conn.query(
        `INSERT INTO borrow_items(receipt_id, copy_id, due_date) VALUES(?,?,?)`,
        [receiptId, c.id, dueStr]
      );
      await conn.query(`UPDATE book_copies SET status='BORROWED' WHERE id=?`, [c.id]);
    }

    await conn.commit();
    res.json({ message: 'Mượn sách thành công', receipt_id: receiptId, due_date: dueStr });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

module.exports = { borrowRouter };
