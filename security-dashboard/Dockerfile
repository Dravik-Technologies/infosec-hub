FROM node:20 AS client-builder
WORKDIR /app/client

COPY security-dashboard/client/package*.json ./
RUN npm ci

COPY security-dashboard/client/ ./
RUN npm run build

FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY packages/db/package*.json packages/db/
RUN cd packages/db && npm ci
COPY packages/db/ packages/db/
RUN cd packages/db && npx prisma generate

COPY security-dashboard/package*.json security-dashboard/
RUN cd security-dashboard && npm ci && npm prune --omit=dev
COPY security-dashboard/ security-dashboard/

FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/security-dashboard

COPY --from=builder /app/security-dashboard/ ./
COPY --from=builder /app/packages/db/src/ /app/packages/db/src/
COPY --from=builder /app/packages/db/node_modules/.prisma /app/packages/db/node_modules/.prisma
COPY --from=builder /app/packages/db/node_modules/@prisma /app/packages/db/node_modules/@prisma
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server.js"]
