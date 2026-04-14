'use strict';

const mongoose = require('mongoose');

// Fail queries immediately instead of buffering when DB is unreachable
mongoose.set('bufferCommands', false);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.warn('[SCORVA] MONGODB_URI not set — running without database (dev bypass only)');
} else {
  mongoose.connect(MONGODB_URI, {
    dbName: 'scorva',
    serverSelectionTimeoutMS: 5000,
  }).catch(err => console.warn('[SCORVA] MongoDB connect failed:', err.message));
}

mongoose.connection.on('connected', () =>
  console.log('[SCORVA] MongoDB connected'));
mongoose.connection.on('error', err =>
  console.error('[SCORVA] MongoDB error:', err.message));
mongoose.connection.on('disconnected', () =>
  console.warn('[SCORVA] MongoDB disconnected'));

module.exports = mongoose;
