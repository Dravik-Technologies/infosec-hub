# ─── Base ────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma

# ─── Development ─────────────────────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development
RUN npm install
RUN npx prisma generate
# NOTE: Do NOT COPY . . here — source is bind-mounted at runtime via docker-compose.
# This keeps the image lean and avoids stale-code issues during development.
EXPOSE 3000
# prisma db push = non-interactive schema sync, works on a fresh DB with no migration files.
# docker-compose.dev.yml overrides this CMD, but it's correct if run standalone.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run dev"]

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

# ─── Production ──────────────────────────────────────────────────────────────
FROM node:20-slim AS production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma      ./prisma
COPY package*.json ./

RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
