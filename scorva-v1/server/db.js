'use strict';

const { db } = require('../../packages/db/src/index');

db.$connect()
  .then(() => console.log('[SCORVA] PostgreSQL connected'))
  .catch(err => console.warn('[SCORVA] PostgreSQL connect failed:', err.message));

module.exports = db;
