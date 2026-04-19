'use strict';

const { db } = require('../../packages/db/src/index');

db.$connect()
  .then(() => console.log('[MASH] PostgreSQL connected'))
  .catch(err => console.warn('[MASH] PostgreSQL connect failed:', err.message));

module.exports = db;
