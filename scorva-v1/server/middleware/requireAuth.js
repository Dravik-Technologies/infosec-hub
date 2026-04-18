'use strict';

const { verifyAccessToken } = require('./jwt');

/**
 * requireAuth — Express middleware
 * Validates a JWT bearer token and exposes claims on `req.user`.
 * Falls back to an existing server session for backwards compatibility.
 */
module.exports = function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (bearer) {
    try {
      const claims = verifyAccessToken(bearer);
      const siteIDs = Array.isArray(claims.siteIDs) ? claims.siteIDs.filter(Boolean) : [];
      const siteID = claims.siteID || siteIDs[0] || null;
      req.user = {
        id: claims.sub,
        username: claims.username,
        email: claims.email,
        name: claims.name,
        initials: claims.initials,
        role: claims.role,
        siteID,
        siteIDs,
        site: siteID,
      };
      if (!req.session) req.session = {};
      req.session.user = req.user;
      return next();
    } catch (_) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Legacy session fallback while routes are fully migrated to JWT clients.
  if (req.session?.user) {
    const sessionSiteIDs = Array.isArray(req.session.user.siteIDs)
      ? req.session.user.siteIDs.filter(Boolean)
      : [req.session.user.siteID || req.session.user.site].filter(Boolean);
    const sessionSiteID = req.session.user.siteID || req.session.user.site || sessionSiteIDs[0] || null;
    req.user = {
      ...req.session.user,
      siteID: sessionSiteID,
      siteIDs: sessionSiteIDs,
      site: sessionSiteID,
    };
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
};
