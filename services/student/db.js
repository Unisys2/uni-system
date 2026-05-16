// Student service database (SQLite via node:sqlite). Owns the `students` table.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'student.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Undeclared',
    level      TEXT NOT NULL DEFAULT 'L1',
    status     TEXT NOT NULL DEFAULT 'active'
  );
`);

module.exports = {
  createStudent(s) {
    db.prepare(
      `INSERT OR IGNORE INTO students (id, name, email, department, level, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(s.id, s.name, s.email, s.department, s.level, s.status);
  },
  listStudents() {
    return db.prepare('SELECT * FROM students').all();
  },
  getStudent(id) {
    return db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  },
  updateStudent(id, fields) {
    db.prepare(
      'UPDATE students SET department = ?, level = ?, status = ? WHERE id = ?'
    ).run(fields.department, fields.level, fields.status, id);
    return this.getStudent(id);
  },
};
