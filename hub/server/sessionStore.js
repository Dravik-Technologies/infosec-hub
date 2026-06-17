'use strict';

const session = require('express-session');
const pg = require('pg');
const connectPgSimple = require('connect-pg-simple');

const PgStore = connectPgSimple(session);

let pool;
let ensurePromise;

async function ensureSessionTable(currentPool) {
  await currentPool.query(`
    CREATE TABLE IF NOT EXISTS hub_sessions (
      sid varchar NOT NULL,
      sess json NOT NULL,
      expire timestamp(6) NOT NULL
    );
  `);

  await currentPool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hub_sessions_pkey'
          AND conrelid = 'hub_sessions'::regclass
      ) THEN
        ALTER TABLE hub_sessions
        ADD CONSTRAINT hub_sessions_pkey PRIMARY KEY (sid);
      END IF;
    END $$;
  `);

  await currentPool.query(`
    CREATE INDEX IF NOT EXISTS hub_sessions_expire_idx
    ON hub_sessions (expire);
  `);
}

function getSessionStore() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for HUB session storage');
  }

  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  if (!ensurePromise) {
    ensurePromise = ensureSessionTable(pool).catch((error) => {
      ensurePromise = null;
      console.error('[HUB] Failed to prepare session store', error.message);
      throw error;
    });
  }

  return new PgStore({
    pool,
    tableName: 'hub_sessions',
    createTableIfMissing: false,
    pruneSessionInterval: 15 * 60,
  });
}

module.exports = { getSessionStore };
