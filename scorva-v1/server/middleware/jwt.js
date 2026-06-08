'use strict';

const jwt = require('jsonwebtoken');
const { getLegacyPlatformRole, normalizePlatformRole } = require('../../../packages/db/src/appAccess');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-jwt-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Validate JWT_SECRET in production
if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('dev-jwt-secret'))) {
  console.error('FATAL: JWT_SECRET must be set to a strong secret (32+ chars) in production');
  process.exit(1);
}

/**
 * Signs a JWT that carries tenant identity claims.
 * Payload includes role + site claims so tenant middleware can enforce isolation.
 */
function signAccessToken(user) {
  const siteIDs = Array.isArray(user.siteIDs)
    ? user.siteIDs.filter(Boolean)
    : Array.isArray(user.siteIds)
      ? user.siteIds.filter(Boolean)
      : [];
  const primarySiteID = user.primarySiteId || user.siteID || user.siteId || siteIDs[0] || null;
  const hubRole = normalizePlatformRole(user.hubRole || user.role);
  const jobRole = user.jobRole || user.securityRole || null;
  const allowedApps = Array.isArray(user.allowedApps) ? user.allowedApps.filter(Boolean) : [];
  return jwt.sign(
    {
      authVersion: 3,
      sub: user.id,
      username: user.username,
      email: user.email || null,
      name: user.name || null,
      initials: user.initials || null,
      hubRole,
      jobRole,
      primarySiteId: primarySiteID,
      siteIds: siteIDs,
      allowedApps,
      canSeeAllSites: Boolean(user.canSeeAllSites),
      tokenEpoch: user.tokenEpoch || 0,

      // Legacy compatibility claims retained during migration.
      role: getLegacyPlatformRole(hubRole),
      securityRole: jobRole,
      siteID: primarySiteID,
      siteIDs,
      siteId: primarySiteID,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verifies a bearer token and returns its decoded claims.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
