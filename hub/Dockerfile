# ── Stage 1: build React client ─────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY hub/client/package*.json ./
RUN npm ci

COPY hub/client/ ./
RUN npm run build

# ── Stage 2: production server ───────────────────────────────────────────────
FROM node:20-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/hub

COPY hub/package*.json ./
RUN npm ci

COPY packages/db/prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

RUN npm prune --omit=dev

COPY hub/server/ ./server/
COPY packages/db/src/ /app/packages/db/src/
COPY --from=client-builder /app/client/dist ./client/dist

RUN chown -R node:node /app
USER node

EXPOSE 3010
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
