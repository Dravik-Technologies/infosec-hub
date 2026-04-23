'use strict';

const crypto = require('crypto');

function buildNotificationId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `N-${ts}-${rand}`;
}

module.exports = { buildNotificationId };
