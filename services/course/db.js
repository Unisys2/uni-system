// Course service database (SQLite via node:sqlite).
// Owns `courses` and `enrollments` tables.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'course.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id       TEXT PRIMARY KEY,
    title    TEXT NOT NULL,
    code     TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    semester TEXT NOT NULL,
    tuition  REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id         TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    course_id  TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'enrolled'
  );
`);

// enrolledCount = active enrollments for a course.
function enrolledCount(courseId) {
  return db.prepare(
    `SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ? AND status = 'enrolled'`
  ).get(courseId).n;
}

function withCount(course) {
  return { ...course, enrolled: enrolledCount(course.id) };
}

module.exports = {
  createCourse(c) {
    db.prepare(
      'INSERT INTO courses (id, title, code, capacity, semester, tuition) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(c.id, c.title, c.code, c.capacity, c.semester, c.tuition);
    return withCount(c);
  },
  listCourses() {
    return db.prepare('SELECT * FROM courses').all().map(withCount);
  },
  getCourse(id) {
    const c = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
    return c ? withCount(c) : null;
  },
  enrolledCount,
  findEnrollment(studentId, courseId) {
    return db.prepare(
      `SELECT * FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'enrolled'`
    ).get(studentId, courseId);
  },
  createEnrollment(e) {
    db.prepare(
      'INSERT INTO enrollments (id, student_id, course_id, status) VALUES (?, ?, ?, ?)'
    ).run(e.id, e.student_id, e.course_id, e.status);
  },
  getEnrollment(id) {
    return db.prepare('SELECT * FROM enrollments WHERE id = ?').get(id);
  },
  dropEnrollment(id) {
    db.prepare(`UPDATE enrollments SET status = 'dropped' WHERE id = ?`).run(id);
  },
  listEnrollmentsByStudent(studentId) {
    return db.prepare('SELECT * FROM enrollments WHERE student_id = ?').all(studentId);
  },
};
