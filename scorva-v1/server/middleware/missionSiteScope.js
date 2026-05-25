'use strict';

function normalizeSites(...values) {
  const flat = values.flatMap(v => Array.isArray(v) ? v : [v]);
  return [...new Set(flat.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

module.exports = function missionSiteScope(req, res, next) {
  // Honor canSeeAllSites from HUB token (Corporate Security Admin + MTSI-ALX)
  // and fall back to role check for legacy tokens that predate the flag
  const isCorporateAdmin = Boolean(req.user?.canSeeAllSites) || req.user?.role === 'Corporate Admin';
  const selectedHeaderSite = (req.headers['x-selected-site'] || '').toString().trim() || null;
  const tokenSiteIds = normalizeSites(req.user?.siteIds, req.user?.siteIDs, req.user?.siteId, req.user?.siteID, req.user?.site);
  const activeSiteId = isCorporateAdmin
    ? (selectedHeaderSite || null)
    : (req.tenantSiteId || req.tenantSiteID || tokenSiteIds[0] || null);
  const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes((req.method || 'GET').toUpperCase());

  if (!activeSiteId && !isCorporateAdmin) {
    return res.status(400).json({ error: 'An active site must be selected for mission-app data access.' });
  }
  if (!activeSiteId && isCorporateAdmin && !isReadOnly) {
    return res.status(400).json({ error: 'Select a site before creating, updating, importing, or deleting mission-app data.' });
  }
  if (activeSiteId && !isCorporateAdmin && tokenSiteIds.length && !tokenSiteIds.includes(activeSiteId)) {
    return res.status(403).json({ error: 'Forbidden: active site is not authorized for this user.' });
  }

  const attemptedSites = normalizeSites(
    req.params?.siteID, req.params?.siteId, req.params?.site,
    req.query?.siteID,  req.query?.siteId,  req.query?.site,
    req.body?.siteID,   req.body?.siteId,   req.body?.site,
    req.body?.siteIDs,  req.body?.siteIds,  req.body?.sites
  );
  if (activeSiteId && attemptedSites.some(v => v !== activeSiteId)) {
    return res.status(403).json({ error: 'Forbidden: site mismatch with active site context.' });
  }

  req.activeSiteId  = activeSiteId;
  req.siteFilter    = activeSiteId || null;
  req.tenantSiteId  = activeSiteId || null;
  req.tenantSiteIds = activeSiteId ? [activeSiteId] : [];
  req.tenantSiteID  = activeSiteId || null;
  req.tenantSiteIDs = activeSiteId ? [activeSiteId] : [];

  req.applyTenantFilter = function applyTenantFilter(baseWhere = {}) {
    if (!activeSiteId) return baseWhere;
    return { ...baseWhere, siteId: activeSiteId };
  };

  req.resolveTenantSiteId = function resolveTenantSiteId() { return activeSiteId; };
  req.resolveTenantSiteID = req.resolveTenantSiteId;

  req.assertTenantDocument = function assertTenantDocument(doc) {
    if (!activeSiteId) return true;
    if (!doc) return false;
    return (doc.siteId || null) === activeSiteId;
  };

  if (activeSiteId && req.body && typeof req.body === 'object') {
    req.body.siteId = activeSiteId;
  }

  next();
};
