#!/usr/bin/env node
/**
 * SCORVA — SQLite → MongoDB migration script
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-mongo.js
 *
 * Prerequisites:
 *   1. Set MONGODB_URI in .env (or as env var)
 *   2. scorva.db must exist in the project root
 *   3. Run: npm install   (mongoose must be installed)
 *
 * What it does:
 *   - Reads every table from scorva.db using node:sqlite
 *   - Upserts each document into MongoDB (safe to run multiple times)
 *   - Preserves all IDs exactly as-is
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { DatabaseSync } = require('node:sqlite');
const mongoose         = require('mongoose');
const path             = require('path');

const DB_PATH = path.join(__dirname, '..', 'scorva.db');
const MONGO   = process.env.MONGODB_URI;

if (!MONGO) { console.error('MONGODB_URI not set'); process.exit(1); }

const db = new DatabaseSync(DB_PATH);

function parseRow(row) {
  const out = {};
  for (const key of Object.keys(row)) {
    const val = row[key];
    if (typeof val === 'string' && val.length > 1 &&
        ((val[0] === '[' && val[val.length - 1] === ']') ||
         (val[0] === '{' && val[val.length - 1] === '}'))) {
      try { out[key] = JSON.parse(val); } catch { out[key] = val; }
    } else {
      out[key] = val;
    }
  }
  return out;
}

function rows(sql) {
  return db.prepare(sql).all().map(parseRow);
}

async function upsertMany(Model, docs, idField = '_id') {
  if (!docs.length) return;
  const ops = docs.map(doc => {
    const { id, ...rest } = doc;
    const _id = id || doc._id;
    return {
      updateOne: {
        filter: { _id },
        update: { $set: { _id, ...rest } },
        upsert: true,
      },
    };
  });
  const result = await Model.bulkWrite(ops, { ordered: false });
  console.log(`  ✓ ${Model.modelName}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
}

// Lazy-require models so mongoose is connected first
async function run() {
  console.log('\n[SCORVA migrate] Connecting to MongoDB...');
  await mongoose.connect(MONGO, { dbName: 'scorva' });
  console.log('[SCORVA migrate] Connected.\n');

  const models = {
    Site:         require('../server/models/Site'),
    User:         require('../server/models/User'),
    ATO:          require('../server/models/ATO'),
    ConMon:       require('../server/models/ConMon'),
    Control:      require('../server/models/Control'),
    POAM:         require('../server/models/POAM'),
    Task:         require('../server/models/Task'),
    Workstation:  require('../server/models/Workstation'),
    YubiKey:      require('../server/models/YubiKey'),
    Agreement:    require('../server/models/Agreement'),
    License:      require('../server/models/License'),
    Tracker:      require('../server/models/Tracker'),
    Notification: require('../server/models/Notification'),
    AuditLog:     require('../server/models/AuditLog'),
  };

  const tableMap = {
    Site:         { sql: 'SELECT * FROM sites',         Model: models.Site },
    User:         { sql: 'SELECT * FROM users',         Model: models.User },
    ATO:          { sql: 'SELECT * FROM ato',           Model: models.ATO },
    ConMon:       { sql: 'SELECT * FROM conmon',        Model: models.ConMon },
    Control:      { sql: 'SELECT * FROM controls',      Model: models.Control },
    POAM:         { sql: 'SELECT * FROM poam',          Model: models.POAM },
    Task:         { sql: 'SELECT * FROM tasks',         Model: models.Task },
    Workstation:  { sql: 'SELECT * FROM workstations',  Model: models.Workstation },
    YubiKey:      { sql: 'SELECT * FROM yubikeys',      Model: models.YubiKey },
    Agreement:    { sql: 'SELECT * FROM agreements',    Model: models.Agreement },
    License:      { sql: 'SELECT * FROM licenses',      Model: models.License },
    Notification: { sql: 'SELECT * FROM notifications', Model: models.Notification },
    AuditLog:     { sql: 'SELECT * FROM audit_log',     Model: models.AuditLog },
  };

  // Trackers use auto-generated ObjectId _id in SQLite (integer) — map to string
  const trackerRows = rows('SELECT * FROM trackers').map(r => ({ ...r, _id: String(r.id) }));

  for (const [name, { sql, Model }] of Object.entries(tableMap)) {
    console.log(`Migrating ${name}...`);
    const data = rows(sql);
    // Map SQLite `id` → Mongoose `_id`
    const docs = data.map(r => ({ _id: r.id || r._id || r.legacy_id, ...r }));
    await upsertMany(Model, docs);
  }

  // Trackers separately (integer id → string _id)
  if (trackerRows.length) {
    console.log('Migrating Trackers...');
    const ops = trackerRows.map(doc => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const result = await models.Tracker.bulkWrite(ops, { ordered: false });
    console.log(`  ✓ Tracker: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
  }

  console.log('\n[SCORVA migrate] Migration complete.\n');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[SCORVA migrate] Fatal:', err.message);
  process.exit(1);
});
