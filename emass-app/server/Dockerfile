# Build context: monorepo root (.)
# docker-compose: context: .  dockerfile: emass-app/server/Dockerfile

FROM node:20 AS builder
WORKDIR /app

# Increase npm timeout and retries to handle slow/flaky registry connections
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5

# ── 1. Install packages/db deps and generate Prisma client ───────
COPY packages/db/package*.json packages/db/
RUN cd packages/db && npm ci
COPY packages/db/ packages/db/
RUN cd packages/db && npx prisma generate

# ── 2. Install server deps and compile TypeScript ─────────────────
COPY emass-app/server/package*.json emass-app/server/
RUN cd emass-app/server && npm ci
COPY emass-app/server/ emass-app/server/
RUN cd emass-app/server && npm run build

# ── Runtime image ─────────────────────────────────────────────────
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Prisma generated client + query engine binaries
COPY --from=builder /app/packages/db/node_modules/.prisma  packages/db/node_modules/.prisma/
COPY --from=builder /app/packages/db/node_modules/@prisma  packages/db/node_modules/@prisma/

# Server: compiled JS + runtime node_modules
COPY --from=builder /app/emass-app/server/dist        emass-app/server/dist/
COPY --from=builder /app/emass-app/server/node_modules emass-app/server/node_modules/

WORKDIR /app/emass-app/server
EXPOSE 3001
CMD ["node", "dist/server.js"]
