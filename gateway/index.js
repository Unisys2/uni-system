// API Gateway: the single entry point for clients.
// Exposes REST + GraphQL over HTTP/1.1, and talks to microservices over gRPC.

const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5');

const restRouter = require('./rest');
const { typeDefs, resolvers } = require('./graphql');
const { gatewayPort } = require('../shared/env');

async function main() {
  const app = express();
  app.use(express.json());

  // Health check.
  app.get('/', (req, res) => {
    res.json({ status: 'ok', interfaces: ['REST /api', 'GraphQL /graphql'] });
  });

  // REST interface.
  app.use('/api', restRouter);

  // GraphQL interface.
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use('/graphql', expressMiddleware(apollo));

  app.listen(gatewayPort, () => {
    console.log(`[gateway] REST   -> http://localhost:${gatewayPort}/api`);
    console.log(`[gateway] GraphQL-> http://localhost:${gatewayPort}/graphql`);
  });
}

main().catch((err) => {
  console.error('[gateway] failed to start:', err);
  process.exit(1);
});
