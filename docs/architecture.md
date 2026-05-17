# Architecture Plan

## Overview

The system is a microservices application. A client never talks to a microservice
directly: all traffic enters through the **API Gateway**, which translates REST and
GraphQL requests into **gRPC** calls. Microservices stay decoupled and communicate
asynchronously through **Kafka** events.

## Components

| Component   | Technology            | Role |
|-------------|-----------------------|------|
| Client      | `.http` request file  | Tests the gateway over REST & GraphQL |
| API Gateway | Express + Apollo      | Single entry point, REST + GraphQL, gRPC clients |
| Auth MS     | Node.js + gRPC        | Registration, login, JWT, roles |
| Student MS  | Node.js + gRPC        | Student academic profiles |
| Course MS   | Node.js + gRPC        | Courses, enrollments, capacity |
| Payment MS  | Node.js + gRPC        | Tuition invoices and payments |
| Attendance MS | Node.js + gRPC      | QR check-in and attendance reports |
| Kafka       | apache/kafka (KRaft)  | Asynchronous event bus |

## Communication

| From → To                 | Protocol | Format    | Usage |
|---------------------------|----------|-----------|-------|
| Client → Gateway          | HTTP/1.1 | JSON      | REST + GraphQL |
| Gateway → Microservices   | HTTP/2   | Protobuf  | gRPC unary calls |
| Microservice ⇄ Microservice | TCP    | JSON msg  | Kafka events |

- **gRPC** is the synchronous request/response channel. Each microservice exposes a
  gRPC server defined by a `.proto` contract; the gateway holds one gRPC client per
  service.
- **Kafka** is the asynchronous channel. It is used only for real business side
  effects across service boundaries (never for plain reads).

## Ports

| Service     | gRPC port |
|-------------|-----------|
| Auth        | 50051     |
| Student     | 50052     |
| Course      | 50053     |
| Payment     | 50054     |
| Attendance  | 50055     |
| Gateway     | 3000 (HTTP) |
| Kafka       | 9092 / 29092 |

## Design principles

- **Single responsibility** — each service owns exactly one domain.
- **Database per service** — no shared tables; services never read each other's DB.
- **Thin gateway** — routing and auth only; business logic lives in the services.
- **Contract-first gRPC** — `.proto` files are the interface, kept separate from the
  implementation in each service's `index.js`.
- **Event-driven decoupling** — a service reacts to events without knowing the
  producer.

## Project layout

```
proto/        gRPC contracts (.proto)
shared/       env config, gRPC loader, Kafka helper
services/     auth | student | course | payment | attendance  (index.js + db.js)
gateway/      clients.js, rest.js, graphql.js, index.js
client/       requests.http
docs/         documentation
```
