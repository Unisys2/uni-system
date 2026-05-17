// Helper to load a .proto file into a usable gRPC package definition.
// Keeps the contract (proto) loading logic in one place.

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_DIR = path.join(__dirname, '..', 'proto');

// loadProto('auth') -> the gRPC package object for proto/auth.proto.
function loadProto(name) {
  const definition = protoLoader.loadSync(path.join(PROTO_DIR, `${name}.proto`), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(definition);
}

module.exports = { grpc, loadProto };
