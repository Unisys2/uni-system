// Central configuration. Reads environment variables so the same code runs
// locally (npm run ...) or inside Docker (hostnames set by docker-compose).

const ENV = process.env;

// gRPC ports are fixed; only the host changes between local and Docker.
const services = {
  auth: { host: ENV.AUTH_HOST || 'localhost', port: 50051 },
  student: { host: ENV.STUDENT_HOST || 'localhost', port: 50052 },
  course: { host: ENV.COURSE_HOST || 'localhost', port: 50053 },
  payment: { host: ENV.PAYMENT_HOST || 'localhost', port: 50054 },
  attendance: { host: ENV.ATTENDANCE_HOST || 'localhost', port: 50055 },
};

// address(name) -> "host:port" used by gRPC clients.
function address(name) {
  const s = services[name];
  return `${s.host}:${s.port}`;
}

module.exports = {
  services,
  address,
  kafkaBroker: ENV.KAFKA_BROKER || 'localhost:9092',
  gatewayPort: Number(ENV.GATEWAY_PORT || 3000),
  jwtSecret: ENV.JWT_SECRET || 'university_secret_change_me',
};
