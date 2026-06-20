'use strict';

const { verifyAccessToken } = require('./jwt');
const { getTokenEpoch } = require('../../../packages/db/src/tokenEpochCache');
const { db } = require('../../../packages/db/src');
const {
  getAllowedApps,
  getDisplayRole,
  getLegacyPlatformRole,
  getSecurityRole,
  canSeeAllSites,
  normalizePlatformRole,
} = require('../../../packages/db/src/appAccess');

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

async function hydrateCanonicalUser(userLike = {}) {
  const userId = userLike.sub || userLike.id || null;
  if (!userId) return null;

  const found = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      title: true,
      role: true,
      siteId: true,
      siteIds: true,
      status: true,
      dod8140: true,
      tokenEpoch: true,
    },
  });

  if (!found || found.status !== 'Active') return null;

  const siteIds = normalizeSiteList(found.siteIds, found.siteId);
  const siteId = found.siteId || siteIds[0] || null;
  const hubRole = normalizePlatformRole(found.role);
  const jobRole = getSecurityRole(found) || String(found.title || '').trim() || null;
  const initials = String(found.name || '')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    authVersion: Number(userLike.authVersion || 3),
    id: found.id,
    username: found.username,
    email: found.email || userLike.email || null,
    name: found.name || userLike.name || null,
    initials: userLike.initials || initials || null,
    title: found.title || null,
    displayRole: getDisplayRole(found),
    hubRole,
    jobRole,
    primarySiteId: siteId,
    role: getLegacyPlatformRole(hubRole),
    siteID: siteId,
    siteIDs: siteIds,
    site: siteId,
    siteId,
    siteIds,
    canSeeAllSites: canSeeAllSites(found),
    securityRole: jobRole,
    allowedApps: getAllowedApps(found),
    tokenEpoch: Number.isFinite(Number(found.tokenEpoch)) ? Number(found.tokenEpoch) : 0,
  };
}

module.exports = async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const cookieToken = req.cookies?.scorva_auth || null;
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookieToken;

  if (bearer) {
    try {
      const claims = verifyAccessToken(bearer);

      // Validate token epoch (revocation check)
      const currentEpoch = await getTokenEpoch(db, claims.sub || claims.id);
      const jwtEpoch = claims.tokenEpoch ?? 0;
      if (jwtEpoch < currentEpoch) {
        return res.status(401).json({ error: 'Token revoked' });
      }

      const canonical = await hydrateCanonicalUser(claims);
      if (!canonical) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.user = canonical;
      if (!req.session) req.session = {};
      req.session.user = req.user;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Legacy session fallback while routes are fully migrated to JWT clients.
  if (req.session?.user) {
    (async () => {
      try {
        // Validate token epoch (revocation check) for session users too
        const sessionUserId = req.session.user.sub || req.session.user.id;
        const currentEpoch = await getTokenEpoch(db, sessionUserId);
        const sessionEpoch = req.session.user.tokenEpoch ?? 0;
        if (sessionEpoch < currentEpoch) {
          return res.status(401).json({ error: 'Token revoked' });
        }

        const canonical = await hydrateCanonicalUser(req.session.user);
        if (!canonical) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = canonical;
        req.session.user = canonical;
        return next();
      } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    })();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
};
