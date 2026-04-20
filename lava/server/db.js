'use strict';

const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;
const db = globalForPrisma.__lavaDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__lavaDb = db;

module.exports = { db };
