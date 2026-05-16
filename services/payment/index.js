// Payment microservice: gRPC server for tuition invoices and payments.
// Database: SQLite (payments).
// Kafka: consumes `student.enrolled` to auto-generate a tuition invoice.

const crypto = require('crypto');

const { grpc, loadProto } = require('../../shared/grpc');
const { startConsumer } = require('../../shared/kafka');
const { services } = require('../../shared/env');
const db = require('./db');

// Flat scholarship discount applied to every tuition invoice.
const SCHOLARSHIP_RATE = 0.1;

// --- gRPC handlers ---------------------------------------------------------

function PayInvoice(call, callback) {
  const invoice = db.getInvoice(call.request.invoice_id);
  if (!invoice) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'invoice not found' });
  }
  if (invoice.status === 'paid') {
    return callback({ code: grpc.status.FAILED_PRECONDITION, message: 'invoice already paid' });
  }
  callback(null, db.markPaid(invoice.id));
}

function GetPaymentsByStudent(call, callback) {
  callback(null, { payments: db.listByStudent(call.request.student_id) });
}

// --- Kafka event handlers --------------------------------------------------

function onEvent(topic, payload) {
  if (topic === 'student.enrolled') {
    const amount = Number((payload.tuition * (1 - SCHOLARSHIP_RATE)).toFixed(2));
    db.createInvoice({
      id: crypto.randomUUID(),
      student_id: payload.studentId,
      course_id: payload.courseId,
      amount,
      created_at: new Date().toISOString(),
    });
    console.log(`[payment] invoice ${amount} created for ${payload.studentId}`);
  }
}

// --- server bootstrap ------------------------------------------------------

async function main() {
  await startConsumer('payment-service', 'payment-group', ['student.enrolled'], onEvent);

  const proto = loadProto('payment').payment;
  const server = new grpc.Server();
  server.addService(proto.PaymentService.service, { PayInvoice, GetPaymentsByStudent });

  const addr = `0.0.0.0:${services.payment.port}`;
  server.bindAsync(addr, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`[payment] gRPC server listening on ${addr}`);
  });
}

main().catch((err) => {
  console.error('[payment] failed to start:', err);
  process.exit(1);
});
