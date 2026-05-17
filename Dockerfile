# Single shared image for the gateway and all 5 microservices.
# docker-compose overrides the `command` to pick which one runs.
# Node 24 is required for the built-in node:sqlite module.
FROM node:24

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Default command (overridden per service in docker-compose.yml).
CMD ["node", "gateway/index.js"]
