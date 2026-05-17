// gRPC clients used by the API Gateway to reach each microservice.
// The gateway holds no business logic - it only forwards calls.

const { grpc, loadProto } = require('../shared/grpc');
const { address } = require('../shared/env');

function makeClient(name, packageName, serviceName) {
  const pkg = loadProto(name)[packageName];
  return new pkg[serviceName](address(name), grpc.credentials.createInsecure());
}

const clients = {
  auth: makeClient('auth', 'auth', 'AuthService'),
  student: makeClient('student', 'student', 'StudentService'),
  course: makeClient('course', 'course', 'CourseService'),
  payment: makeClient('payment', 'payment', 'PaymentService'),
  attendance: makeClient('attendance', 'attendance', 'AttendanceService'),
};

// Promise wrapper around a unary gRPC call.
function call(service, method, request = {}) {
  return new Promise((resolve, reject) => {
    clients[service][method](request, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

// Maps gRPC status codes to HTTP status codes for clean REST errors.
function httpStatus(grpcCode) {
  switch (grpcCode) {
    case grpc.status.INVALID_ARGUMENT:
    case grpc.status.FAILED_PRECONDITION:
      return 400;
    case grpc.status.UNAUTHENTICATED:
      return 401;
    case grpc.status.NOT_FOUND:
      return 404;
    case grpc.status.ALREADY_EXISTS:
    case grpc.status.RESOURCE_EXHAUSTED:
      return 409;
    default:
      return 500;
  }
}

module.exports = { call, httpStatus };
