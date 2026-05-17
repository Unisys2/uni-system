// Thin wrapper around kafkajs: one producer helper and one consumer helper.
// Used by every microservice for asynchronous, event-driven communication.

const { Kafka, logLevel } = require('kafkajs');
const { kafkaBroker } = require('./env');

function createKafka(clientId) {
  return new Kafka({
    clientId,
    brokers: [kafkaBroker],
    logLevel: logLevel.ERROR,
    retry: { retries: 20, initialRetryTime: 1000 },
  });
}

// Connects a producer and returns publish(topic, payloadObject).
async function startProducer(clientId) {
  const producer = createKafka(clientId).producer();
  await producer.connect();
  console.log(`[kafka] producer connected (${clientId})`);
  return {
    publish: async (topic, payload) => {
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      });
      console.log(`[kafka] -> ${topic}`, payload);
    },
  };
}

// Subscribes a consumer to topics; calls handler(topic, payloadObject) per message.
async function startConsumer(clientId, groupId, topics, handler) {
  const consumer = createKafka(clientId).consumer({ groupId });
  await consumer.connect();
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        console.log(`[kafka] <- ${topic}`, payload);
        await handler(topic, payload);
      } catch (err) {
        console.error(`[kafka] handler error on ${topic}:`, err.message);
      }
    },
  });
  console.log(`[kafka] consumer subscribed (${groupId}): ${topics.join(', ')}`);
}

module.exports = { startProducer, startConsumer };
