# REST Endpoints

All REST endpoints are exposed by the **API Gateway** under the `/api` prefix.
Each one forwards to a microservice over gRPC.

Base URL: `http://localhost:3000`

Protected endpoints require an `Authorization: Bearer <token>` header. The token is
obtained from `/api/auth/login` and verified through the Auth service.

## Auth

| Method | Path                 | Auth | Description |
|--------|----------------------|------|-------------|
| POST   | `/api/auth/register` | no   | Create a user account (role: student/professor/admin) |
| POST   | `/api/auth/login`    | no   | Log in, returns a JWT |
| GET    | `/api/auth/profile`  | yes  | Current user from the token |

`POST /api/auth/register`
```json
{ "name": "Yahia", "email": "yahia@university.edu", "password": "secret123", "role": "student" }
```

## Students

| Method | Path                  | Auth | Description |
|--------|-----------------------|------|-------------|
| GET    | `/api/students`       | no   | List all students |
| GET    | `/api/students/:id`   | no   | Get one student |
| PUT    | `/api/students/:id`   | yes  | Update department / level / status |

## Courses & Enrollments

| Method | Path                     | Auth | Description |
|--------|--------------------------|------|-------------|
| POST   | `/api/courses`           | yes  | Create a course |
| GET    | `/api/courses`           | no   | List courses |
| GET    | `/api/courses/:id`       | no   | Get one course |
| POST   | `/api/enrollments`       | yes  | Enroll a student in a course |
| DELETE | `/api/enrollments/:id`   | yes  | Drop an enrollment |

`POST /api/courses`
```json
{ "title": "Microservices", "code": "CS301", "capacity": 30, "semester": "2025-S1", "tuition": 500 }
```

`POST /api/enrollments`
```json
{ "student_id": "<id>", "course_id": "<id>" }
```

## Payments

| Method | Path                          | Auth | Description |
|--------|-------------------------------|------|-------------|
| POST   | `/api/payments`               | yes  | Pay an existing tuition invoice |
| GET    | `/api/payments/student/:id`   | no   | List a student's invoices/payments |

`POST /api/payments`
```json
{ "invoice_id": "<id>" }
```

## Attendance

| Method | Path                            | Auth | Description |
|--------|---------------------------------|------|-------------|
| POST   | `/api/attendance/check-in`      | yes  | Record a QR check-in |
| GET    | `/api/attendance/student/:id`   | no   | Attendance report for a student |
| GET    | `/api/attendance/course/:id`    | no   | Attendance records for a course |

`POST /api/attendance/check-in`
```json
{ "student_id": "<id>", "course_id": "<id>", "qr_code": "SESSION-QR-2025" }
```

## Error mapping

gRPC status codes are mapped to HTTP status codes:

| gRPC status            | HTTP |
|------------------------|------|
| INVALID_ARGUMENT / FAILED_PRECONDITION | 400 |
| UNAUTHENTICATED        | 401 |
| NOT_FOUND              | 404 |
| ALREADY_EXISTS / RESOURCE_EXHAUSTED | 409 |
| other                  | 500 |

Error responses: `{ "error": "<message>" }`
