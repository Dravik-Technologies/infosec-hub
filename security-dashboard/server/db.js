'use strict';

const mongoose = require('mongoose');

// Share the same MongoDB server as Scorva/Hub; use a dedicated 'mash' database.
// Set MONGODB_URI to the server URI (e.g. mongodb://127.0.0.1:27017) or a full URI.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mash';

mongoose.set('bufferCommands', false);

mongoose.connect(MONGODB_URI, {
  dbName:                   'mash',
  serverSelectionTimeoutMS: 3000,
  connectTimeoutMS:         5000,
})
  .then(() => console.log('[MASH] MongoDB connected:', MONGODB_URI))
  .catch(err => console.warn('[MASH] MongoDB unavailable — falling back to JSON files:', err.message));

mongoose.connection.on('error',        err  => console.error('[MASH] MongoDB error:',        err.message));
mongoose.connection.on('disconnected', ()   => console.warn ('[MASH] MongoDB disconnected'));

module.exports = mongoose;
