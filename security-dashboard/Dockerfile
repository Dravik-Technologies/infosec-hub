FROM node:20 AS builder
WORKDIR /app

COPY packages/db/package*.json packages/db/
RUN cd packages/db && npm ci
COPY packages/db/ packages/db/
RUN cd packages/db && npx prisma generate

COPY security-dashboard/package*.json security-dashboard/
RUN cd security-dashboard && npm ci
COPY security-dashboard/ security-dashboard/
RUN cd security-dashboard && npm prune --omit=dev

FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/security-dashboard

COPY --from=builder /app/security-dashboard/ ./
COPY --from=builder /app/packages/db/src/ /app/packages/db/src/
COPY --from=builder /app/packages/db/node_modules/.prisma /app/packages/db/node_modules/.prisma
COPY --from=builder /app/packages/db/node_modules/@prisma /app/packages/db/node_modules/@prisma

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server.js"]
