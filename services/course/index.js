// Course microservice: gRPC server for courses and enrollments.
// Database: SQLite (courses, enrollments). Kafka: produces `student.enrolled`.

const crypto = require('crypto');

const { grpc, loadProto } = require('../../shared/grpc');
const { startProducer } = require('../../shared/kafka');
const { services } = require('../../shared/env');
const db = require('./db');

let producer;

// --- gRPC handlers ---------------------------------------------------------

function CreateCourse(call, callback) {
  const { title, code, capacity, semester, tuition } = call.request;
  if (!title || !code || capacity <= 0) {
    return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'title, code and positive capacity required' });
  }
  const course = db.createCourse({
    id: crypto.randomUUID(), title, code, capacity, semester: semester || 'N/A', tuition: tuition || 0,
  });
  callback(null, course);
}

function ListCourses(call, callback) {
  callback(null, { courses: db.listCourses() });
}

function GetCourse(call, callback) {
  const course = db.getCourse(call.request.id);
  if (!course) return callback({ code: grpc.status.NOT_FOUND, message: 'course not found' });
  callback(null, course);
}

async function Enroll(call, callback) {
  const { student_id, course_id } = call.request;
  const course = db.getCourse(course_id);
  if (!course) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'course not found' });
  }
  if (db.findEnrollment(student_id, course_id)) {
    return callback({ code: grpc.status.ALREADY_EXISTS, message: 'student already enrolled in this course' });
  }
  if (db.enrolledCount(course_id) >= course.capacity) {
    return callback({ code: grpc.status.RESOURCE_EXHAUSTED, message: 'course is full' });
  }

  const enrollment = {
    id: crypto.randomUUID(), student_id, course_id, status: 'enrolled',
  };
  db.createEnrollment(enrollment);

  // Event-driven: Payment generates an invoice, Attendance enables check-in.
  await producer.publish('student.enrolled', {
    studentId: student_id,
    courseId: course_id,
    courseTitle: course.title,
    tuition: course.tuition,
  });

  callback(null, enrollment);
}

function DropEnrollment(call, callback) {
  const enrollment = db.getEnrollment(call.request.id);
  if (!enrollment) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'enrollment not found' });
  }
  db.dropEnrollment(enrollment.id);
  callback(null, {});
}

function ListEnrollmentsByStudent(call, callback) {
  callback(null, { enrollments: db.listEnrollmentsByStudent(call.request.student_id) });
}

// --- server bootstrap ------------------------------------------------------

async function main() {
  producer = await startProducer('course-service');

  const proto = loadProto('course').course;
  const server = new grpc.Server();
  server.addService(proto.CourseService.service, {
    CreateCourse, ListCourses, GetCourse, Enroll, DropEnrollment, ListEnrollmentsByStudent,
  });

  const addr = `0.0.0.0:${services.course.port}`;
  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`[course] gRPC server listening on ${addr}`);
  });
}

main().catch((err) => {
  console.error('[course] failed to start:', err);
  process.exit(1);
});
