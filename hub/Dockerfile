# ── Stage 1: build React client ─────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ── Stage 2: production server ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 3010
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
