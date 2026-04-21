'use strict';

const path = require('path');

// Prefer the client generated alongside the shared schema under packages/db,
// then fall back to the app's node_modules for containerized app builds.
const clientPath = require.resolve('@prisma/client', {
  paths: [path.resolve(__dirname, '..'), process.cwd()],
});
const { PrismaClient } = require(clientPath);

const globalForPrisma = globalThis;
const db = globalForPrisma.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = db;

module.exports = { db };
