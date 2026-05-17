# GraphQL Interface

The API Gateway exposes a GraphQL endpoint at `POST http://localhost:3000/graphql`.

## Why GraphQL here

A university client often needs a **student together with their enrollments,
payments and attendance** — data owned by **four different microservices**. With
REST that means four round trips. With GraphQL the client sends **one query** and
selects exactly the fields it needs; the gateway resolvers fan out to the gRPC
services and assemble the result.

## Schema

```graphql
type User { id: ID!  name: String  email: String  role: String }

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
```

## Example queries

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

### Enroll (mutation)

```graphql
mutation ($s: ID!, $c: ID!) {
  enroll(studentId: $s, courseId: $c) { id status }
}
```

## Resolver mapping

| GraphQL field            | Resolved by gRPC call                         |
|--------------------------|-----------------------------------------------|
| `Query.students`         | `StudentService.ListStudents`                 |
| `Query.student`          | `StudentService.GetStudent`                   |
| `Query.courses`          | `CourseService.ListCourses`                   |
| `Student.enrollments`    | `CourseService.ListEnrollmentsByStudent`      |
| `Student.payments`       | `PaymentService.GetPaymentsByStudent`         |
| `Student.attendance`     | `AttendanceService.GetByStudent`              |
| `Enrollment.course`      | `CourseService.GetCourse`                     |
| `Mutation.enroll`        | `CourseService.Enroll`                        |
| `Mutation.payInvoice`    | `PaymentService.PayInvoice`                   |
