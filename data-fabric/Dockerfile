FROM node:20 AS builder
WORKDIR /app

COPY packages/db/package*.json packages/db/
RUN cd packages/db && npm ci
COPY packages/db/ packages/db/
RUN cd packages/db && npx prisma generate

COPY data-fabric/package*.json data-fabric/
RUN cd data-fabric && npm ci
COPY data-fabric/ data-fabric/
RUN cd data-fabric && npm prune --omit=dev

FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/data-fabric

COPY --from=builder /app/data-fabric/ ./
COPY --from=builder /app/packages/db/src/ /app/packages/db/src/
COPY --from=builder /app/packages/db/node_modules/.prisma /app/packages/db/node_modules/.prisma
COPY --from=builder /app/packages/db/node_modules/@prisma /app/packages/db/node_modules/@prisma

EXPOSE 8081
ENV NODE_ENV=production

CMD ["node", "server.js"]
