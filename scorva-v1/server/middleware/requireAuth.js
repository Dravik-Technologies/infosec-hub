'use strict';

const { verifyAccessToken } = require('./jwt');

/**
 * requireAuth — Express middleware
 * Validates a JWT bearer token and exposes normalized claims on req.user.
 * Falls back to an existing server session for backwards compatibility.
 *
 * Normalizes both HUB-model (lowercase siteId/siteIds) and legacy
 * SCORVA-model (uppercase siteID/siteIDs) field names so downstream
 * middleware and routes always receive consistent field names.
 *
 * Propagates canSeeAllSites and securityRole from the token so the
 * tenant middleware can enforce site scope correctly.
 */

function normalizeSiteList(...values) {
  const flat = values.flatMap(v => Array.isArray(v) ? v : [v]);
  return [...new Set(flat.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

module.exports = function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (bearer) {
    try {
      const claims = verifyAccessToken(bearer);
      // Merge lowercase (HUB) and uppercase (legacy SCORVA) site field variants
      const siteIDs = normalizeSiteList(claims.siteIDs, claims.siteIds, claims.siteID, claims.siteId);
      const siteID  = claims.siteID || claims.siteId || siteIDs[0] || null;
      req.user = {
        id:            claims.sub || claims.id,
        username:      claims.username,
        email:         claims.email,
        name:          claims.name,
        initials:      claims.initials,
        role:          claims.role,
        // Uppercase aliases kept for backward compat with existing middleware
        siteID,
        siteIDs,
        site:          siteID,
        // Lowercase aliases for HUB-model compatibility
        siteId:        siteID,
        siteIds:       siteIDs,
        // Tenant control fields
        canSeeAllSites: Boolean(claims.canSeeAllSites) || claims.role === 'Corporate Admin',
        securityRole:   claims.securityRole || null,
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
    const sessionSiteIDs = normalizeSiteList(
      req.session.user.siteIDs, req.session.user.siteIds,
      req.session.user.siteID,  req.session.user.site
    );
    const sessionSiteID = req.session.user.siteID || req.session.user.siteId
      || req.session.user.site || sessionSiteIDs[0] || null;
    req.user = {
      ...req.session.user,
      siteID:         sessionSiteID,
      siteIDs:        sessionSiteIDs,
      siteId:         sessionSiteID,
      siteIds:        sessionSiteIDs,
      site:           sessionSiteID,
      canSeeAllSites: Boolean(req.session.user.canSeeAllSites) || req.session.user.role === 'Corporate Admin',
      securityRole:   req.session.user.securityRole || null,
    };
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
};
