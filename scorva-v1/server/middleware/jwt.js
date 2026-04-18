'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-jwt-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Signs a JWT that carries tenant identity claims.
 * Payload includes role + site claims so tenant middleware can enforce isolation.
 */
function signAccessToken(user) {
  const siteIDs = Array.isArray(user.siteIDs) ? user.siteIDs.filter(Boolean) : [];
  const primarySiteID = user.siteID || siteIDs[0] || null;
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email || null,
      name: user.name || null,
      initials: user.initials || null,
      role: user.role,
      siteID: primarySiteID,
      siteIDs,
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
