'use strict';

const { db } = require('../../packages/db/src/index');

db.$connect()
  .then(() => console.log('[HUB] PostgreSQL connected'))
  .catch(err => console.warn('[HUB] PostgreSQL connect failed:', err.message));

module.exports = db;
