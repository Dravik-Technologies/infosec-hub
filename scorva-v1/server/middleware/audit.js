'use strict';

const AuditLog = require('../models/AuditLog');

/**
 * Writes an entry to audit_log. Silently swallows errors so audit failures
 * never break the request that triggered them.
 */
module.exports = async function audit(username, action, resource, detail, siteID) {
  const effectiveSiteID = siteID || 'SYSTEM';
  try {
    await AuditLog.create({
      username,
      action,
      resource:  resource  || null,
      detail:    detail    || null,
      siteID:    effectiveSiteID,
      site:      effectiveSiteID,
    });
  } catch (_) {}
};
