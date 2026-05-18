// GraphQL interface of the API Gateway.
// Justification: GraphQL lets a client fetch a student together with their
// enrollments, payments and attendance - data owned by 4 different services -
// in a single request, selecting only the fields it needs.
//
// This module mirrors the full surface of the REST interface: every gRPC
// method exposed by the five microservices has a matching Query or Mutation.

const { call } = require('./clients');

const typeDefs = `#graphql
  type User {
    id: ID!
    name: String
    email: String
    role: String
  }

  # Returned by register / login - carries the JWT used to authorize mutations.
  type AuthReply {
    user: User
    token: String
  }

  type Student {
    id: ID!
    name: String
    email: String
    department: String
    level: String
    status: String
    enrollments: [Enrollment]      # resolved via Course service
    payments: [Payment]            # resolved via Payment service
    attendance: AttendanceReport   # resolved via Attendance service
  }

  type Course {
    id: ID!
    title: String
    code: String
    capacity: Int
    enrolled: Int
    semester: String
    tuition: Float
  }

  type Enrollment {
    id: ID!
    studentId: ID
    courseId: ID
    status: String
    course: Course                 # nested resolve via Course service
    student: Student               # nested resolve via Student service
  }

  type Payment {
    id: ID!
    studentId: ID
    courseId: ID
    amount: Float
    status: String
    createdAt: String
  }

  type AttendanceRecord {
    id: ID!
    studentId: ID
    courseId: ID
    timestamp: String
  }

  type AttendanceReport {
    studentId: ID
    totalCheckIns: Int
    attendancePercentage: Float
    records: [AttendanceRecord]
  }

  # Result of dropping an enrollment (CourseService.DropEnrollment returns Empty).
  type DropResult {
    success: Boolean
    message: String
  }

  type Query {
    # --- Auth ---
    me: User                                  # current user, requires Bearer token

    # --- Students ---
    students: [Student]
    student(id: ID!): Student

    # --- Courses & enrollments ---
    courses: [Course]
    course(id: ID!): Course
    enrollmentsByStudent(studentId: ID!): [Enrollment]

    # --- Payments ---
    paymentsByStudent(studentId: ID!): [Payment]

    # --- Attendance ---
    attendanceByStudent(studentId: ID!): AttendanceReport
    attendanceByCourse(courseId: ID!): [AttendanceRecord]
  }

  type Mutation {
    # --- Auth ---
    register(name: String!, email: String!, password: String!, role: String): AuthReply
    login(email: String!, password: String!): AuthReply

    # --- Students --- (requires Bearer token)
    updateStudent(id: ID!, department: String, level: String, status: String): Student

    # --- Courses & enrollments --- (requires Bearer token)
    createCourse(title: String!, code: String!, capacity: Int!, semester: String!, tuition: Float!): Course
    enroll(studentId: ID!, courseId: ID!): Enrollment
    dropEnrollment(id: ID!): DropResult

    # --- Payments --- (requires Bearer token)
    payInvoice(invoiceId: ID!): Payment

    # --- Attendance --- (requires Bearer token)
    checkIn(studentId: ID!, courseId: ID!, qrCode: String!): AttendanceRecord
  }
`;

// Throws an authentication error unless the request carried a valid JWT.
// `context.token` is populated by the gateway's GraphQL context function.
async function requireAuth(context) {
  if (!context || !context.token) {
    throw new GraphQLAuthError('missing Bearer token');
  }
  try {
    return await call('auth', 'VerifyToken', { token: context.token });
  } catch (err) {
    throw new GraphQLAuthError(err.details || err.message || 'invalid token');
  }
}

class GraphQLAuthError extends Error {
  constructor(message) {
    super(message);
    this.extensions = { code: 'UNAUTHENTICATED' };
  }
}

const resolvers = {
  Query: {
    // --- Auth ---
    me: (_, __, context) => requireAuth(context),

    // --- Students ---
    students: async () => (await call('student', 'ListStudents', {})).students,
    student: (_, { id }) => call('student', 'GetStudent', { id }),

    // --- Courses & enrollments ---
    courses: async () => (await call('course', 'ListCourses', {})).courses,
    course: (_, { id }) => call('course', 'GetCourse', { id }),
    enrollmentsByStudent: async (_, { studentId }) =>
      (await call('course', 'ListEnrollmentsByStudent', { student_id: studentId })).enrollments,

    // --- Payments ---
    paymentsByStudent: async (_, { studentId }) =>
      (await call('payment', 'GetPaymentsByStudent', { student_id: studentId })).payments,

    // --- Attendance ---
    attendanceByStudent: (_, { studentId }) =>
      call('attendance', 'GetByStudent', { student_id: studentId }),
    attendanceByCourse: async (_, { courseId }) =>
      (await call('attendance', 'GetByCourse', { course_id: courseId })).records,
  },

  Mutation: {
    // --- Auth --- (public)
    register: (_, { name, email, password, role }) =>
      call('auth', 'Register', { name, email, password, role }),
    login: (_, { email, password }) =>
      call('auth', 'Login', { email, password }),

    // --- Students --- (auth required)
    updateStudent: async (_, { id, department, level, status }, context) => {
      await requireAuth(context);
      return call('student', 'UpdateStudent', { id, department, level, status });
    },

    // --- Courses & enrollments --- (auth required)
    createCourse: async (_, { title, code, capacity, semester, tuition }, context) => {
      await requireAuth(context);
      return call('course', 'CreateCourse', { title, code, capacity, semester, tuition });
    },
    enroll: async (_, { studentId, courseId }, context) => {
      await requireAuth(context);
      return call('course', 'Enroll', { student_id: studentId, course_id: courseId });
    },
    dropEnrollment: async (_, { id }, context) => {
      await requireAuth(context);
      await call('course', 'DropEnrollment', { id });
      return { success: true, message: 'enrollment dropped' };
    },

    // --- Payments --- (auth required)
    payInvoice: async (_, { invoiceId }, context) => {
      await requireAuth(context);
      return call('payment', 'PayInvoice', { invoice_id: invoiceId });
    },

    // --- Attendance --- (auth required)
    checkIn: async (_, { studentId, courseId, qrCode }, context) => {
      await requireAuth(context);
      return call('attendance', 'CheckIn', {
        student_id: studentId,
        course_id: courseId,
        qr_code: qrCode,
      });
    },
  },

  Student: {
    enrollments: async (s) =>
      (await call('course', 'ListEnrollmentsByStudent', { student_id: s.id })).enrollments,
    payments: async (s) =>
      (await call('payment', 'GetPaymentsByStudent', { student_id: s.id })).payments,
    attendance: (s) => call('attendance', 'GetByStudent', { student_id: s.id }),
  },

  Enrollment: {
    studentId: (e) => e.student_id,
    courseId: (e) => e.course_id,
    course: (e) => call('course', 'GetCourse', { id: e.course_id }),
    student: (e) => call('student', 'GetStudent', { id: e.student_id }),
  },

  Payment: {
    studentId: (p) => p.student_id,
    courseId: (p) => p.course_id,
    createdAt: (p) => p.created_at,
  },

  AttendanceRecord: {
    studentId: (r) => r.student_id,
    courseId: (r) => r.course_id,
  },

  AttendanceReport: {
    studentId: (r) => r.student_id,
    totalCheckIns: (r) => r.total_check_ins,
    attendancePercentage: (r) => r.attendance_percentage,
  },
};

module.exports = { typeDefs, resolvers };
