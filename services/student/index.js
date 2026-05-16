// Student microservice: gRPC server for student academic profiles.
// Database: SQLite (students).
// Kafka: consumes `user.registered` (auto-create profile) and `attendance.checked_in`.

const { grpc, loadProto } = require('../../shared/grpc');
const { startConsumer } = require('../../shared/kafka');
const { services } = require('../../shared/env');
const db = require('./db');

// --- gRPC handlers ---------------------------------------------------------

function ListStudents(call, callback) {
  callback(null, { students: db.listStudents() });
}

function GetStudent(call, callback) {
  const student = db.getStudent(call.request.id);
  if (!student) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'student not found' });
  }
  callback(null, student);
}

function UpdateStudent(call, callback) {
  const { id, department, level, status } = call.request;
  const current = db.getStudent(id);
  if (!current) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'student not found' });
  }
  // Empty fields keep their current value.
  const updated = db.updateStudent(id, {
    department: department || current.department,
    level: level || current.level,
    status: status || current.status,
  });
  callback(null, updated);
}

// --- Kafka event handlers --------------------------------------------------

function onEvent(topic, payload) {
  if (topic === 'user.registered' && payload.role === 'student') {
    db.createStudent({
      id: payload.id,
      name: payload.name,
      email: payload.email,
      department: 'Undeclared',
      level: 'L1',
      status: 'active',
    });
    console.log(`[student] profile created for ${payload.email}`);
  }
  if (topic === 'attendance.checked_in') {
    console.log(`[student] ${payload.studentId} checked in to ${payload.courseId}`);
  }
}

// --- server bootstrap ------------------------------------------------------

async function main() {
  await startConsumer('student-service', 'student-group',
    ['user.registered', 'attendance.checked_in'], onEvent);

  const proto = loadProto('student').student;
  const server = new grpc.Server();
  server.addService(proto.StudentService.service, { ListStudents, GetStudent, UpdateStudent });

  const addr = `0.0.0.0:${services.student.port}`;
  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`[student] gRPC server listening on ${addr}`);
  });
}

main().catch((err) => {
  console.error('[student] failed to start:', err);
  process.exit(1);
});
