# Databases

Each microservice owns its **own independent database**. No service reads or writes
another service's database; cross-service data is exchanged through gRPC or Kafka.

Only the database technologies allowed by the project brief are used:
**SQL databases** and **RxDB** (NoSQL).

## Summary

| Service     | Database | Type  | Storage                |
|-------------|----------|-------|------------------------|
| Auth        | SQLite   | SQL   | `data/auth.db`         |
| Student     | SQLite   | SQL   | `data/student.db`      |
| Course      | SQLite   | SQL   | `data/course.db`       |
| Payment     | SQLite   | SQL   | `data/payment.db`      |
| Attendance  | RxDB     | NoSQL | in-memory storage      |

SQLite is accessed through Node's built-in `node:sqlite` module (no native build
step). RxDB uses the in-memory storage adapter (`getRxStorageMemory`) for
zero-configuration setup.

## Schemas

### Auth — `users` (SQLite)

| Column         | Type | Notes              |
|----------------|------|--------------------|
| id             | TEXT | primary key (UUID) |
| name           | TEXT |                    |
| email          | TEXT | unique             |
| password_hash  | TEXT | bcrypt hash        |
| role           | TEXT | student/professor/admin |

### Student — `students` (SQLite)

| Column     | Type | Notes              |
|------------|------|--------------------|
| id         | TEXT | primary key (= auth user id) |
| name       | TEXT |                    |
| email      | TEXT |                    |
| department | TEXT |                    |
| level      | TEXT | L1..M2             |
| status     | TEXT | active/suspended/graduated |

### Course — `courses` + `enrollments` (SQLite)

`courses`

| Column   | Type    | Notes              |
|----------|---------|--------------------|
| id       | TEXT    | primary key (UUID) |
| title    | TEXT    |                    |
| code     | TEXT    |                    |
| capacity | INTEGER |                    |
| semester | TEXT    |                    |
| tuition  | REAL    |                    |

`enrollments`

| Column     | Type | Notes              |
|------------|------|--------------------|
| id         | TEXT | primary key (UUID) |
| student_id | TEXT |                    |
| course_id  | TEXT |                    |
| status     | TEXT | enrolled/dropped   |

### Payment — `payments` (SQLite)

| Column     | Type | Notes              |
|------------|------|--------------------|
| id         | TEXT | primary key (invoice id) |
| student_id | TEXT |                    |
| course_id  | TEXT |                    |
| amount     | REAL | after scholarship discount |
| status     | TEXT | pending/paid       |
| created_at | TEXT | ISO timestamp      |

### Attendance — RxDB collections (NoSQL)

`attendance`

| Field     | Type   |
|-----------|--------|
| id        | string (UUID, primary key) |
| studentId | string |
| courseId  | string |
| timestamp | string |

`enrollments` (mirror, fed by the `student.enrolled` event — used to validate
check-ins)

| Field     | Type   |
|-----------|--------|
| id        | string (`studentId::courseId`, primary key) |
| studentId | string |
| courseId  | string |
