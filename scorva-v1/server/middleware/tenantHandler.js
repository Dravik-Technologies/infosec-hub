'use strict';

function normalizeSites(...values) {
  const flat = values.flatMap(v => Array.isArray(v) ? v : [v]);
  return [...new Set(flat.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

module.exports = function tenantHandler(req, res, next) {
  const role = req.user?.role;
  const selectedSite = (req.headers['x-selected-site'] || '').toString().trim() || null;
  // Honor canSeeAllSites from HUB token (Corporate Security Admin + MTSI-ALX)
  // and fall back to role check for legacy tokens that predate the flag
  const isCorporateAdmin = Boolean(req.user?.canSeeAllSites) || role === 'Corporate Admin';

  const tokenSiteIds = normalizeSites(req.user?.siteIds, req.user?.siteIDs, req.user?.siteId, req.user?.siteID);
  if (!isCorporateAdmin && !tokenSiteIds.length) {
    return res.status(403).json({ error: 'Forbidden: no site access assigned' });
  }
  const tenantSiteIds = isCorporateAdmin ? normalizeSites(selectedSite) : tokenSiteIds;
  const tenantSiteId  = tenantSiteIds[0] || null;

  req.siteFilter    = tenantSiteId;
  req.tenantSiteId  = tenantSiteId;
  req.tenantSiteIds = tenantSiteIds;
  // Legacy aliases kept for middleware that still reads siteID/siteIDs
  req.tenantSiteID  = tenantSiteId;
  req.tenantSiteIDs = tenantSiteIds;

  req.applyTenantFilter = function applyTenantFilter(baseWhere = {}) {
    if (!req.tenantSiteIds.length) return baseWhere;
    return { ...baseWhere, siteId: { in: req.tenantSiteIds } };
  };

  req.resolveTenantSiteId = function resolveTenantSiteId(payload = {}) {
    const payloadSiteId = payload.siteId || payload.siteID || payload.site || null;
    if (isCorporateAdmin) return req.tenantSiteId || payloadSiteId || null;
    if (payloadSiteId && tokenSiteIds.includes(payloadSiteId)) return payloadSiteId;
    return tokenSiteIds[0] || null;
  };
  req.resolveTenantSiteID = req.resolveTenantSiteId; // legacy alias

  req.assertTenantDocument = function assertTenantDocument(doc) {
    if (!doc || !req.tenantSiteIds.length) return true;
    return req.tenantSiteIds.includes(doc.siteId || null);
  };

  if (!isCorporateAdmin) {
    const attemptedSites = normalizeSites(
      req.params?.siteID, req.params?.siteId, req.params?.site,
      req.query?.siteID,  req.query?.siteId,  req.query?.site,
      req.body?.siteID,   req.body?.siteId,   req.body?.site,
      req.body?.siteIDs,  req.body?.siteIds,  req.body?.sites,
      selectedSite
    );
    if (attemptedSites.some(v => !tokenSiteIds.includes(v))) {
      return res.status(403).json({ error: 'Forbidden: tenant mismatch' });
    }
  }

  if (req.body && typeof req.body === 'object') {
    const eff = req.resolveTenantSiteId(req.body);
    if (eff) req.body.siteId = eff;
  }

  next();
};
