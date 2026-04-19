'use strict';

// Resolve @prisma/client from the app's own node_modules (process.cwd()),
// not from packages/db — this ensures the correct platform binary is used
// whether running locally or inside a Docker container.
const clientPath = require.resolve('@prisma/client', { paths: [process.cwd()] });
const { PrismaClient } = require(clientPath);

const globalForPrisma = globalThis;
const db = globalForPrisma.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = db;

module.exports = { db };
