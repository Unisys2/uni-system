# University Enrollment & Attendance Management System

A microservices application for managing university **registration, authentication,
course enrollment, tuition payments and attendance tracking**.

Built for the *SoA and Microservices* mini-project. Node.js only.

## Architecture

```
              client/requests.http
                      |  REST + GraphQL  (HTTP/1.1 . JSON)
                      v
                 API Gateway              :3000
                      |  gRPC  (HTTP/2 . Protobuf)
   +--------+---------+---------+---------+----------+
   v        v         v         v         v
  Auth   Student   Course    Payment   Attendance
 :50051   :50052   :50053    :50054     :50055
 SQLite   SQLite   SQLite    SQLite      RxDB
   \________ \________|________/ ________/
                      |
               Kafka Event Bus            :9092
```

- **API Gateway** — the only entry point. Exposes **REST** and **GraphQL** to clients,
  forwards every call to a microservice over **gRPC**. Contains no business logic.
- **5 microservices** — each owns one responsibility and its own database.
- **Kafka** — asynchronous, event-driven communication between services.

See [docs/architecture.md](docs/architecture.md) for the full description.

## Microservices

| Service     | Responsibility                                   | Database |
|-------------|--------------------------------------------------|----------|
| Auth        | registration, login, JWT, roles                  | SQLite   |
| Student     | student academic profiles                        | SQLite   |
| Course      | courses, enrollments, capacity                   | SQLite   |
| Payment     | tuition invoices, payments, scholarship discount | SQLite   |
| Attendance  | QR check-in, attendance reports                  | RxDB     |

## Technology stack

- **Node.js** + **Express** (gateway)
- **gRPC** (`@grpc/grpc-js`) — gateway ⇄ microservices
- **GraphQL** (`@apollo/server`) + **REST** — client ⇄ gateway
- **Apache Kafka** (`kafkajs`) — service ⇄ service events
- **SQLite** (built-in `node:sqlite`) and **RxDB** — databases
- **Docker / Docker Compose** — containerization

> Requires **Node.js 24+** (for the built-in `node:sqlite` module).

## Run with Docker (recommended)

```bash
docker compose up --build
```

This starts Kafka + the 5 services + the gateway. The gateway is available at
`http://localhost:3000`.

## Run locally (without Docker)

```bash
# 1. start only the Kafka broker
docker compose up kafka

# 2. install dependencies
npm install

# 3. in separate terminals
npm run auth
npm run student
npm run course
npm run payment
npm run attendance
npm run gateway
```

`shared/env.js` reads environment variables (see `.env.example`); defaults target
`localhost`, so local runs work without any configuration.

## Testing the application

Open [client/requests.http](client/requests.http) in VS Code with the **REST Client**
extension and send the requests top to bottom. A typical end-to-end scenario:

1. `POST /api/auth/register` — registers a student → Kafka `user.registered` →
   Student service auto-creates the profile.
2. `POST /api/auth/login` — returns a JWT.
3. `POST /api/courses` — creates a course.
4. `POST /api/enrollments` — enrolls the student → Kafka `student.enrolled` →
   Payment creates an invoice, Attendance enables check-in.
5. `POST /api/attendance/check-in` — records attendance → Kafka `attendance.checked_in`.
6. `GET /graphql` query — fetches the student with enrollments, payments and
   attendance in one request.

## Documentation

- [docs/architecture.md](docs/architecture.md) — architecture plan
- [docs/rest-endpoints.md](docs/rest-endpoints.md) — REST endpoints
- [docs/graphql.md](docs/graphql.md) — GraphQL schema & example queries
- [docs/kafka-topics.md](docs/kafka-topics.md) — Kafka topics & events
- [docs/databases.md](docs/databases.md) — databases used
- [proto/](proto/) — gRPC contracts (`.proto` files)
