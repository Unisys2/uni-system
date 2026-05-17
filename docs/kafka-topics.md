# Kafka Topics & Events

Kafka provides **asynchronous, event-driven communication** between microservices.
A service publishes an event when something business-relevant happens; other
services react without being directly called. This keeps the services decoupled.

The broker runs in **KRaft mode** (no Zookeeper). Topics are created automatically
on first use.

## Topics

| Topic                   | Producer    | Consumer(s)            |
|-------------------------|-------------|------------------------|
| `user.registered`       | Auth        | Student                |
| `student.enrolled`      | Course      | Payment, Attendance    |
| `attendance.checked_in` | Attendance  | Student                |

## `user.registered`

Published by **Auth** after a successful registration.

```json
{ "id": "u-123", "name": "Yahia", "email": "yahia@university.edu", "role": "student" }
```

- **Student** consumes it and, if `role == "student"`, auto-creates the student
  academic profile. The Auth and Student databases stay independent.

## `student.enrolled`

Published by **Course** when a student is enrolled in a course.

```json
{ "studentId": "u-123", "courseId": "c-456", "courseTitle": "Microservices", "tuition": 500 }
```

- **Payment** consumes it and generates a *pending* tuition invoice (with the
  scholarship discount applied).
- **Attendance** consumes it and records that the student is allowed to check in to
  that course.

## `attendance.checked_in`

Published by **Attendance** when a QR check-in is recorded.

```json
{ "studentId": "u-123", "courseId": "c-456", "timestamp": "2026-05-15T09:00:00.000Z" }
```

- **Student** consumes it to track student activity.

## Triggering scenario

1. A student registers → `user.registered` → profile created.
2. The student enrolls in a course → `student.enrolled` → invoice created +
   check-in enabled.
3. The student scans the QR code → `attendance.checked_in` → activity tracked.

Each step is a real business event; Kafka is never used artificially just to move
data around.
