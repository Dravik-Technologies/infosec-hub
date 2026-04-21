'use strict';

const { db } = require('../packages/db/src');

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function readDocument(name) {
  const row = await db.dataFabricDocument.findUnique({ where: { name } });
  return row ? row.data : null;
}

async function writeDocument(name, data) {
  await db.dataFabricDocument.upsert({
    where: { name },
    create: { name, data },
    update: { data },
  });
}

async function seedDocument(name, fallbackData) {
  const existing = await readDocument(name);
  if (existing == null && fallbackData != null) {
    await writeDocument(name, fallbackData);
    return fallbackData;
  }
  return existing;
}

async function createSession(token) {
  await db.dataFabricSession.create({
    data: {
      token,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
}

async function hasSession(token) {
  const row = await db.dataFabricSession.findUnique({ where: { token } });
  if (!row) return false;
  if (row.expiresAt <= new Date()) {
    await db.dataFabricSession.delete({ where: { token } }).catch(() => {});
    return false;
  }
  return true;
}

async function deleteSession(token) {
  await db.dataFabricSession.delete({ where: { token } }).catch(() => {});
}

async function cleanupExpiredSessions() {
  await db.dataFabricSession.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });
}

module.exports = {
  cleanupExpiredSessions,
  createSession,
  deleteSession,
  hasSession,
  isDbConfigured,
  readDocument,
  seedDocument,
  writeDocument,
};
