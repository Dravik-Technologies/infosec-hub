FROM node:20 AS client-builder
WORKDIR /app/client

COPY nexus/client/package*.json ./
RUN npm ci

COPY nexus/client/ ./
RUN npm run build

FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY packages/db/package*.json packages/db/
RUN cd packages/db && npm ci
COPY packages/db/ packages/db/
RUN cd packages/db && npx prisma generate

COPY nexus/package*.json nexus/
RUN cd nexus && npm ci && npm prune --omit=dev
COPY nexus/ nexus/

FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/nexus

COPY --from=builder /app/nexus/ ./
COPY --from=builder /app/packages/db/src/ /app/packages/db/src/
COPY --from=builder /app/packages/db/node_modules/.prisma /app/packages/db/node_modules/.prisma
COPY --from=builder /app/packages/db/node_modules/@prisma /app/packages/db/node_modules/@prisma
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 8090
ENV NODE_ENV=production
CMD ["node", "server.js"]
