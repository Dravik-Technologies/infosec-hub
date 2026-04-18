'use strict';

function normalizeSites(...values) {
  const flat = values.flatMap(v => Array.isArray(v) ? v : [v]);
  return [...new Set(flat.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

module.exports = function missionSiteScope(req, res, next) {
  const isCorporateAdmin = req.user?.role === 'Corporate Admin';
  const selectedHeaderSite = (req.headers['x-selected-site'] || '').toString().trim() || null;
  const tokenSiteIDs = normalizeSites(req.user?.siteIDs, req.user?.siteID, req.user?.site);
  const activeSiteID = isCorporateAdmin
    ? (selectedHeaderSite || null)
    : (req.tenantSiteID || tokenSiteIDs[0] || null);
  const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes((req.method || 'GET').toUpperCase());

  if (!activeSiteID && !isCorporateAdmin) {
    return res.status(400).json({ error: 'An active site must be selected for mission-app data access.' });
  }
  if (!activeSiteID && isCorporateAdmin && !isReadOnly) {
    return res.status(400).json({ error: 'Select a site before creating, updating, importing, or deleting mission-app data.' });
  }

  if (activeSiteID && !isCorporateAdmin && tokenSiteIDs.length && !tokenSiteIDs.includes(activeSiteID)) {
    return res.status(403).json({ error: 'Forbidden: active site is not authorized for this user.' });
  }

  const attemptedSites = normalizeSites(
    req.params?.siteID, req.params?.siteId, req.params?.site,
    req.query?.siteID, req.query?.siteId, req.query?.site,
    req.body?.siteID, req.body?.siteId, req.body?.site,
    req.body?.siteIDs, req.body?.sites
  );
  const hasMismatch = activeSiteID
    ? attemptedSites.some(value => value !== activeSiteID)
    : false;
  if (hasMismatch) {
    return res.status(403).json({ error: 'Forbidden: site mismatch with active site context.' });
  }

  req.activeSiteID = activeSiteID;
  req.siteFilter = activeSiteID || null;
  req.tenantSiteID = activeSiteID || null;
  req.tenantSiteIDs = activeSiteID ? [activeSiteID] : [];

  req.applyTenantFilter = function applyTenantFilter(baseFilter = {}) {
    if (!activeSiteID) return { ...baseFilter };
    return { ...baseFilter, siteID: activeSiteID };
  };

  req.resolveTenantSiteID = function resolveTenantSiteID() {
    if (!activeSiteID) return null;
    return activeSiteID;
  };

  req.assertTenantDocument = function assertTenantDocument(doc) {
    if (!activeSiteID) return true;
    if (!doc) return false;
    return (doc.siteID || doc.site || null) === activeSiteID;
  };

  if (activeSiteID && req.body && typeof req.body === 'object') {
    req.body.siteID = activeSiteID;
    req.body.site = activeSiteID;
  }

  next();
};
