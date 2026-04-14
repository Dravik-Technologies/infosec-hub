'use strict';

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scorva';

// Disable operation buffering — queries fail immediately if not connected
// instead of queuing indefinitely and timing out after 10 s.
mongoose.set('bufferCommands', false);

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 3000,   // give up finding a server after 3 s
  connectTimeoutMS:         5000,
})
  .then(() => console.log('[HUB] MongoDB connected:', MONGODB_URI))
  .catch(err => console.warn('[HUB] MongoDB unavailable — will proxy auth to SCORVA:', err.message));

module.exports = mongoose;
