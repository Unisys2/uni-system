// Attendance microservice: gRPC server for QR-code check-in and reports.
// Database: RxDB (NoSQL).
// Kafka: consumes `student.enrolled`, produces `attendance.checked_in`.

const crypto = require('crypto');

const { grpc, loadProto } = require('../../shared/grpc');
const { startProducer, startConsumer } = require('../../shared/kafka');
const { services } = require('../../shared/env');
const db = require('./db');

// Assumed number of sessions per course, used for the attendance percentage.
const SESSIONS_PER_COURSE = 10;

let producer;

// --- gRPC handlers ---------------------------------------------------------

async function CheckIn(call, callback) {
  const { student_id, course_id, qr_code } = call.request;
  if (!qr_code) {
    return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'qr_code is required' });
  }
  if (!(await db.isEnrolled(student_id, course_id))) {
    return callback({ code: grpc.status.FAILED_PRECONDITION, message: 'student is not enrolled in this course' });
  }

  const record = {
    id: crypto.randomUUID(),
    studentId: student_id,
    courseId: course_id,
    timestamp: new Date().toISOString(),
  };
  await db.addCheckIn(record);

  await producer.publish('attendance.checked_in', {
    studentId: student_id,
    courseId: course_id,
    timestamp: record.timestamp,
  });

  callback(null, {
    id: record.id, student_id, course_id, timestamp: record.timestamp,
  });
}

function toRecord(r) {
  return { id: r.id, student_id: r.studentId, course_id: r.courseId, timestamp: r.timestamp };
}

async function GetByStudent(call, callback) {
  try {
    const studentId = call.request.student_id;
    const records = await db.listByStudent(studentId);
    const courses = await db.countEnrolledCourses(studentId);
    const expected = courses * SESSIONS_PER_COURSE;
    const percentage = expected ? Number(((records.length / expected) * 100).toFixed(1)) : 0;
    callback(null, {
      student_id: studentId,
      total_check_ins: records.length,
      attendance_percentage: percentage,
      records: records.map(toRecord),
    });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function GetByCourse(call, callback) {
  try {
    const records = await db.listByCourse(call.request.course_id);
    callback(null, { records: records.map(toRecord) });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

// --- Kafka event handlers --------------------------------------------------

async function onEvent(topic, payload) {
  if (topic === 'student.enrolled') {
    await db.recordEnrollment(payload.studentId, payload.courseId);
    console.log(`[attendance] ${payload.studentId} may now check in to ${payload.courseId}`);
  }
}

// --- server bootstrap ------------------------------------------------------

async function main() {
  await db.init();
  producer = await startProducer('attendance-service');
  await startConsumer('attendance-service', 'attendance-group', ['student.enrolled'], onEvent);

  const proto = loadProto('attendance').attendance;
  const server = new grpc.Server();
  server.addService(proto.AttendanceService.service, { CheckIn, GetByStudent, GetByCourse });

  const addr = `0.0.0.0:${services.attendance.port}`;
  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`[attendance] gRPC server listening on ${addr}`);
  });
}

main().catch((err) => {
  console.error('[attendance] failed to start:', err);
  process.exit(1);
});
