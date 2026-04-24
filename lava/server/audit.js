'use strict';

const { db } = require('./db');

function actor(req) {
  const user = req.session && req.session.user;
  if (!user) return null;
  return user.username || user.email || user.name || null;
}

async function writeAudit(req, action, entityType, entityId, details, siteId) {
  try {
    await db.lavaAuditLog.create({
      data: {
        actor: actor(req),
        action,
        entityType,
        entityId: entityId || null,
        details: details || null,
        siteId: siteId || ((req.session && req.session.user && req.session.user.siteId) || null),
      },
    });
  } catch (err) {
    console.error('[LAVA/audit] failed to write audit log', err);
  }
}

module.exports = { actor, writeAudit };
