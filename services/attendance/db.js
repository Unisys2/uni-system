// Attendance service database (RxDB - NoSQL, in-memory storage).
// Two collections: `attendance` (check-in records) and `enrollments`
// (mirror of who may check in, fed by the student.enrolled Kafka event).

const { createRxDatabase } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');

const attendanceSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    studentId: { type: 'string' },
    courseId: { type: 'string' },
    timestamp: { type: 'string' },
  },
  required: ['id', 'studentId', 'courseId', 'timestamp'],
};

const enrollmentSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 }, // studentId::courseId
    studentId: { type: 'string' },
    courseId: { type: 'string' },
  },
  required: ['id', 'studentId', 'courseId'],
};

let attendance;
let enrollments;

async function init() {
  const db = await createRxDatabase({
    name: 'attendancedb',
    storage: getRxStorageMemory(),
    ignoreDuplicate: true,
  });
  await db.addCollections({
    attendance: { schema: attendanceSchema },
    enrollments: { schema: enrollmentSchema },
  });
  attendance = db.attendance;
  enrollments = db.enrollments;
  console.log('[attendance] RxDB initialised');
}

module.exports = {
  init,
  async recordEnrollment(studentId, courseId) {
    await enrollments.upsert({ id: `${studentId}::${courseId}`, studentId, courseId });
  },
  async isEnrolled(studentId, courseId) {
    const doc = await enrollments.findOne(`${studentId}::${courseId}`).exec();
    return !!doc;
  },
  async addCheckIn(record) {
    await attendance.insert(record);
    return record;
  },
  async listByStudent(studentId) {
    const docs = await attendance.find({ selector: { studentId } }).exec();
    return docs.map((d) => d.toJSON());
  },
  async listByCourse(courseId) {
    const docs = await attendance.find({ selector: { courseId } }).exec();
    return docs.map((d) => d.toJSON());
  },
  async countEnrolledCourses(studentId) {
    const docs = await enrollments.find({ selector: { studentId } }).exec();
    return docs.length;
  },
};
