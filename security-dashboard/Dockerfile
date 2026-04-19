FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/security-dashboard

COPY security-dashboard/package*.json ./
RUN npm ci --omit=dev

COPY security-dashboard/ ./

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server.js"]
