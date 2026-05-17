// REST interface of the API Gateway. Classic CRUD operations, each mapped
// 1:1 to a gRPC call on a microservice.

const express = require('express');
const { call, httpStatus } = require('./clients');

const router = express.Router();

// Wraps an async handler and converts gRPC errors into HTTP responses.
function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      res.status(httpStatus(err.code)).json({ error: err.details || err.message });
    }
  };
}

// JWT middleware: verifies the Bearer token via the Auth service.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'missing Bearer token' });
    req.user = await call('auth', 'VerifyToken', { token });
    next();
  } catch (err) {
    res.status(httpStatus(err.code)).json({ error: err.details || err.message });
  }
}

// --- Auth ------------------------------------------------------------------

router.post('/auth/register', handle(async (req, res) => {
  const reply = await call('auth', 'Register', req.body);
  res.status(201).json(reply);
}));

router.post('/auth/login', handle(async (req, res) => {
  res.json(await call('auth', 'Login', req.body));
}));

router.get('/auth/profile', requireAuth, handle(async (req, res) => {
  res.json(req.user);
}));

// --- Students --------------------------------------------------------------

router.get('/students', handle(async (req, res) => {
  res.json((await call('student', 'ListStudents', {})).students);
}));

router.get('/students/:id', handle(async (req, res) => {
  res.json(await call('student', 'GetStudent', { id: req.params.id }));
}));

router.put('/students/:id', requireAuth, handle(async (req, res) => {
  res.json(await call('student', 'UpdateStudent', { id: req.params.id, ...req.body }));
}));

// --- Courses & enrollments -------------------------------------------------

router.post('/courses', requireAuth, handle(async (req, res) => {
  res.status(201).json(await call('course', 'CreateCourse', req.body));
}));

router.get('/courses', handle(async (req, res) => {
  res.json((await call('course', 'ListCourses', {})).courses);
}));

router.get('/courses/:id', handle(async (req, res) => {
  res.json(await call('course', 'GetCourse', { id: req.params.id }));
}));

router.post('/enrollments', requireAuth, handle(async (req, res) => {
  res.status(201).json(await call('course', 'Enroll', req.body));
}));

router.delete('/enrollments/:id', requireAuth, handle(async (req, res) => {
  await call('course', 'DropEnrollment', { id: req.params.id });
  res.json({ message: 'enrollment dropped' });
}));

// --- Payments --------------------------------------------------------------

router.post('/payments', requireAuth, handle(async (req, res) => {
  res.json(await call('payment', 'PayInvoice', req.body));
}));

router.get('/payments/student/:id', handle(async (req, res) => {
  res.json((await call('payment', 'GetPaymentsByStudent', { student_id: req.params.id })).payments);
}));

// --- Attendance ------------------------------------------------------------

router.post('/attendance/check-in', requireAuth, handle(async (req, res) => {
  res.status(201).json(await call('attendance', 'CheckIn', req.body));
}));

router.get('/attendance/student/:id', handle(async (req, res) => {
  res.json(await call('attendance', 'GetByStudent', { student_id: req.params.id }));
}));

router.get('/attendance/course/:id', handle(async (req, res) => {
  res.json((await call('attendance', 'GetByCourse', { course_id: req.params.id })).records);
}));

module.exports = router;
