'use strict';

const { db } = require('../../../packages/db/src/index');

module.exports = async function audit(username, action, resource, detail, siteId) {
  try {
    await db.auditLog.create({
      data: {
        username: username || null,
        action,
        resource: resource || null,
        detail:   detail   || null,
        siteId:   siteId   || 'SYSTEM',
      },
    });
  } catch (_) {}
};
