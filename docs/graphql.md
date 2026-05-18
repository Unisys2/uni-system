# GraphQL Interface

The API Gateway exposes a GraphQL endpoint at `POST http://localhost:3000/graphql`.

## Why GraphQL here

A university client often needs a **student together with their enrollments,
payments and attendance** — data owned by **four different microservices**. With
REST that means four round trips. With GraphQL the client sends **one query** and
selects exactly the fields it needs; the gateway resolvers fan out to the gRPC
services and assemble the result.

The GraphQL surface mirrors the full REST surface: **every gRPC method** of the
five microservices has a matching Query or Mutation.

## Authentication

Public operations: `register`, `login`, and all read queries except `me`.

All write mutations (`updateStudent`, `createCourse`, `enroll`, `dropEnrollment`,
`payInvoice`, `checkIn`) and the `me` query require a JWT. Send it as an HTTP
header on the GraphQL request:

```
Authorization: Bearer <token>
```

The gateway extracts the token into the GraphQL context; protected resolvers
verify it against `AuthService.VerifyToken` before doing any work. A missing or
invalid token yields a GraphQL error with `extensions.code = "UNAUTHENTICATED"`.

## Schema

```graphql
type User { id: ID!  name: String  email: String  role: String }

type AuthReply { user: User  token: String }

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
  id: ID!  title: String  code: String
  capacity: Int  enrolled: Int  semester: String  tuition: Float
}

type Enrollment {
  id: ID!  studentId: ID  courseId: ID  status: String
  course: Course                 # nested resolve
  student: Student               # nested resolve
}

type Payment {
  id: ID!  studentId: ID  courseId: ID
  amount: Float  status: String  createdAt: String
}

type AttendanceRecord { id: ID!  studentId: ID  courseId: ID  timestamp: String }

type AttendanceReport {
  studentId: ID
  totalCheckIns: Int
  attendancePercentage: Float
  records: [AttendanceRecord]
}

type DropResult { success: Boolean  message: String }

type Query {
  me: User                                       # requires Bearer token
  students: [Student]
  student(id: ID!): Student
  courses: [Course]
  course(id: ID!): Course
  enrollmentsByStudent(studentId: ID!): [Enrollment]
  paymentsByStudent(studentId: ID!): [Payment]
  attendanceByStudent(studentId: ID!): AttendanceReport
  attendanceByCourse(courseId: ID!): [AttendanceRecord]
}

type Mutation {
  register(name: String!, email: String!, password: String!, role: String): AuthReply
  login(email: String!, password: String!): AuthReply
  updateStudent(id: ID!, department: String, level: String, status: String): Student
  createCourse(title: String!, code: String!, capacity: Int!, semester: String!, tuition: Float!): Course
  enroll(studentId: ID!, courseId: ID!): Enrollment
  dropEnrollment(id: ID!): DropResult
  payInvoice(invoiceId: ID!): Payment
  checkIn(studentId: ID!, courseId: ID!, qrCode: String!): AttendanceRecord
}
```

## Example operations

### Register / login

```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user { id name role }
  }
}
```

### Cross-service student view (only selected fields)

```graphql
query ($id: ID!) {
  student(id: $id) {
    name
    level
    enrollments {
      status
      course { title code }
    }
    payments { amount status }
    attendance { totalCheckIns attendancePercentage }
  }
}
```
Variables: `{ "id": "<studentId>" }`

### List courses

```graphql
{
  courses { id title code capacity enrolled tuition }
}
```

### Create a course (mutation, requires token)

```graphql
mutation ($title: String!, $code: String!, $cap: Int!, $sem: String!, $fee: Float!) {
  createCourse(title: $title, code: $code, capacity: $cap, semester: $sem, tuition: $fee) {
    id title code capacity semester tuition
  }
}
```

### Enroll (mutation, requires token)

```graphql
mutation ($s: ID!, $c: ID!) {
  enroll(studentId: $s, courseId: $c) { id status }
}
```

### Check in to a class (mutation, requires token)

```graphql
mutation ($s: ID!, $c: ID!, $qr: String!) {
  checkIn(studentId: $s, courseId: $c, qrCode: $qr) {
    id studentId courseId timestamp
  }
}
```

## Resolver mapping

| GraphQL field                  | Resolved by gRPC call                         | Auth |
|---------------------------------|-----------------------------------------------|------|
| `Query.me`                      | `AuthService.VerifyToken`                     | yes  |
| `Query.students`                | `StudentService.ListStudents`                 | no   |
| `Query.student`                 | `StudentService.GetStudent`                   | no   |
| `Query.courses`                 | `CourseService.ListCourses`                   | no   |
| `Query.course`                  | `CourseService.GetCourse`                     | no   |
| `Query.enrollmentsByStudent`    | `CourseService.ListEnrollmentsByStudent`      | no   |
| `Query.paymentsByStudent`       | `PaymentService.GetPaymentsByStudent`         | no   |
| `Query.attendanceByStudent`     | `AttendanceService.GetByStudent`              | no   |
| `Query.attendanceByCourse`      | `AttendanceService.GetByCourse`               | no   |
| `Student.enrollments`           | `CourseService.ListEnrollmentsByStudent`      | no   |
| `Student.payments`              | `PaymentService.GetPaymentsByStudent`         | no   |
| `Student.attendance`            | `AttendanceService.GetByStudent`              | no   |
| `Enrollment.course`             | `CourseService.GetCourse`                     | no   |
| `Enrollment.student`            | `StudentService.GetStudent`                   | no   |
| `Mutation.register`             | `AuthService.Register`                        | no   |
| `Mutation.login`                | `AuthService.Login`                           | no   |
| `Mutation.updateStudent`        | `StudentService.UpdateStudent`                | yes  |
| `Mutation.createCourse`         | `CourseService.CreateCourse`                  | yes  |
| `Mutation.enroll`               | `CourseService.Enroll`                        | yes  |
| `Mutation.dropEnrollment`       | `CourseService.DropEnrollment`                | yes  |
| `Mutation.payInvoice`           | `PaymentService.PayInvoice`                   | yes  |
| `Mutation.checkIn`              | `AttendanceService.CheckIn`                   | yes  |
