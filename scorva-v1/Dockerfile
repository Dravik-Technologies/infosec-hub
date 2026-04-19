# ── Stage 1: build React client ─────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY scorva-v1/client/package*.json ./
RUN npm ci

COPY scorva-v1/client/ ./
RUN npm run build

# ── Stage 2: production server ───────────────────────────────────────────────
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/scorva-v1

COPY scorva-v1/package*.json ./
RUN npm ci

COPY packages/db/prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

RUN npm prune --omit=dev

COPY scorva-v1/server/ ./server/
COPY packages/db/src/ /app/packages/db/src/
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
