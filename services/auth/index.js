// Auth microservice: gRPC server for registration, login and JWT verification.
// Database: SQLite (users). Kafka: produces `user.registered`.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { grpc, loadProto } = require('../../shared/grpc');
const { startProducer } = require('../../shared/kafka');
const { services, jwtSecret } = require('../../shared/env');
const db = require('./db');

const ROLES = ['student', 'professor', 'admin'];
let producer;

function toUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '12h' });
}

// --- gRPC handlers ---------------------------------------------------------

async function Register(call, callback) {
  const { name, email, password, role } = call.request;
  if (!name || !email || !password) {
    return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'name, email and password are required' });
  }
  const finalRole = ROLES.includes(role) ? role : 'student';
  if (db.findByEmail(email)) {
    return callback({ code: grpc.status.ALREADY_EXISTS, message: 'email already registered' });
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    role: finalRole,
  };
  db.createUser(user);

  // Event-driven: let other services react to a new account.
  await producer.publish('user.registered', {
    id: user.id, name: user.name, email: user.email, role: user.role,
  });

  callback(null, { user: toUser(user), token: signToken(user) });
}

function Login(call, callback) {
  const { email, password } = call.request;
  const row = db.findByEmail(email);
  if (!row || !bcrypt.compareSync(password || '', row.password_hash)) {
    return callback({ code: grpc.status.UNAUTHENTICATED, message: 'invalid email or password' });
  }
  callback(null, { user: toUser(row), token: signToken(row) });
}

function VerifyToken(call, callback) {
  try {
    const decoded = jwt.verify(call.request.token, jwtSecret);
    const row = db.findById(decoded.id);
    if (!row) return callback({ code: grpc.status.UNAUTHENTICATED, message: 'user not found' });
    callback(null, toUser(row));
  } catch {
    callback({ code: grpc.status.UNAUTHENTICATED, message: 'invalid or expired token' });
  }
}

// GetProfile reuses the same logic as VerifyToken.
const GetProfile = VerifyToken;

// --- server bootstrap ------------------------------------------------------

async function main() {
  producer = await startProducer('auth-service');

  const proto = loadProto('auth').auth;
  const server = new grpc.Server();
  server.addService(proto.AuthService.service, { Register, Login, VerifyToken, GetProfile });

  const addr = `0.0.0.0:${services.auth.port}`;
  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`[auth] gRPC server listening on ${addr}`);
  });
}

main().catch((err) => {
  console.error('[auth] failed to start:', err);
  process.exit(1);
});
