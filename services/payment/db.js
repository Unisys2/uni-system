// Payment service database (SQLite via node:sqlite). Owns the `payments` table.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'payment.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id         TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    course_id  TEXT NOT NULL,
    amount     REAL NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
`);

module.exports = {
  createInvoice(p) {
    db.prepare(
      `INSERT INTO payments (id, student_id, course_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    ).run(p.id, p.student_id, p.course_id, p.amount, p.created_at);
  },
  getInvoice(id) {
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  },
  markPaid(id) {
    db.prepare(`UPDATE payments SET status = 'paid' WHERE id = ?`).run(id);
    return this.getInvoice(id);
  },
  listByStudent(studentId) {
    return db.prepare('SELECT * FROM payments WHERE student_id = ?').all(studentId);
  },
};
