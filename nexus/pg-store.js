'use strict';

let db = null;

function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!db) ({ db } = require('../packages/db/src'));
  return db;
}

function dbOk() {
  return Boolean(process.env.DATABASE_URL);
}

async function readCollection(name) {
  const client = getDb();
  if (!client) return null;
  const row = await client.dataFabricDocument.findUnique({ where: { name } });
  if (row) return row.data;

  // Transitional lazy migration from the legacy MASH-owned blob store.
  const legacyRow = await client.mashCollection.findUnique({ where: { name } });
  if (!legacyRow) return null;
  await client.dataFabricDocument.upsert({
    where: { name },
    create: { name, data: legacyRow.data },
    update: { data: legacyRow.data },
  });
  return legacyRow.data;
}

async function writeCollection(name, data) {
  const client = getDb();
  if (!client) throw new Error('DATABASE_URL is not configured');
  await client.dataFabricDocument.upsert({
    where: { name },
    create: { name, data },
    update: { data },
  });
}

module.exports = {
  dbOk,
  getDb,
  readCollection,
  writeCollection,
};
