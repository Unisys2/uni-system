// Auth service database (SQLite via Node's built-in node:sqlite).
// Owns the `users` table only.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'auth.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL
  );
`);

module.exports = {
  createUser(user) {
    db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run(user.id, user.name, user.email, user.password_hash, user.role);
  },
  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },
  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
};
