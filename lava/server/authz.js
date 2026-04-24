'use strict';

const VULCAN_ROLES = new Set(['Corporate Admin', 'Site Admin', 'Admin', 'Vulcan']);

function isVulcanUser(req) {
  return VULCAN_ROLES.has(req.session && req.session.user && req.session.user.role);
}

function requireVulcan(req, res, next) {
  if (isVulcanUser(req)) return next();
  return res.status(403).json({ error: 'Vulcan clearance required' });
}

module.exports = { isVulcanUser, requireVulcan };
