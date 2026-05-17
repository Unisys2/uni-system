// GraphQL interface of the API Gateway.
// Justification: GraphQL lets a client fetch a student together with their
// enrollments, payments and attendance - data owned by 4 different services -
// in a single request, selecting only the fields it needs.

const { call } = require('./clients');

const typeDefs = `#graphql
  type User { id: ID!  name: String  email: String  role: String }

  type Student {
    id: ID!
    name: String
    email: String
    department: String
    level: String
    status: String
    enrollments: [Enrollment]
    payments: [Payment]
    attendance: AttendanceReport
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
    course: Course
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

  type Query {
    students: [Student]
    student(id: ID!): Student
    courses: [Course]
    course(id: ID!): Course
  }

  type Mutation {
    enroll(studentId: ID!, courseId: ID!): Enrollment
    payInvoice(invoiceId: ID!): Payment
  }
`;

const resolvers = {
  Query: {
    students: async () => (await call('student', 'ListStudents', {})).students,
    student: (_, { id }) => call('student', 'GetStudent', { id }),
    courses: async () => (await call('course', 'ListCourses', {})).courses,
    course: (_, { id }) => call('course', 'GetCourse', { id }),
  },

  Mutation: {
    enroll: (_, { studentId, courseId }) =>
      call('course', 'Enroll', { student_id: studentId, course_id: courseId }),
    payInvoice: (_, { invoiceId }) =>
      call('payment', 'PayInvoice', { invoice_id: invoiceId }),
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
