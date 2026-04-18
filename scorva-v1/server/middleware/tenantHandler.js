'use strict';

/**
 * Builds a backward-compatible site filter that matches either the new `siteID`
 * field or the legacy `site` field for existing records.
 */
function siteClause(siteIDs = []) {
  return {
    $or: [
      { siteID: { $in: siteIDs } },
      { site: { $in: siteIDs } },
    ],
  };
}

/**
 * Normalizes a site list from mixed input shapes.
 */
function normalizeSites(...values) {
  const flat = values.flatMap(v => Array.isArray(v) ? v : [v]);
  return [...new Set(flat.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

/**
 * tenantHandler
 *
 * Enforces tenant isolation from JWT claims:
 * - Site User: restricted to token `siteIDs` (or fallback `siteID`).
 * - Corporate Admin: global access unless `x-selected-site` is present, then scoped.
 */
module.exports = function tenantHandler(req, res, next) {
  const role = req.user?.role;
  const selectedSite = (req.headers['x-selected-site'] || '').toString().trim() || null;
  const isCorporateAdmin = role === 'Corporate Admin';

  const tokenSiteIDs = normalizeSites(req.user?.siteIDs, req.user?.siteID);
  if (!isCorporateAdmin && !tokenSiteIDs.length) {
    return res.status(403).json({ error: 'Forbidden: no site access assigned' });
  }
  const tenantSiteIDs = isCorporateAdmin
    ? normalizeSites(selectedSite)
    : tokenSiteIDs;

  const tenantSiteID = tenantSiteIDs[0] || null;

  // Keep compatibility with existing routes that read req.siteFilter/req.tenantSiteID.
  req.siteFilter = tenantSiteID;
  req.tenantSiteID = tenantSiteID;
  req.tenantSiteIDs = tenantSiteIDs;

  /**
   * Applies tenant scoping to an existing query object.
   */
  req.applyTenantFilter = function applyTenantFilter(baseFilter = {}) {
    if (!req.tenantSiteIDs.length) return { ...baseFilter };
    return {
      $and: [
        { ...baseFilter },
        siteClause(req.tenantSiteIDs),
      ],
    };
  };

  /**
   * Returns the effective site for creates/updates and keeps legacy `site` in sync.
   */
  req.resolveTenantSiteID = function resolveTenantSiteID(payload = {}) {
    const payloadSiteID = payload.siteID || payload.site || null;
    if (isCorporateAdmin) {
      return req.tenantSiteID || payloadSiteID || null;
    }
    if (payloadSiteID && tokenSiteIDs.includes(payloadSiteID)) return payloadSiteID;
    return tokenSiteIDs[0] || null;
  };

  /**
   * Checks whether a document belongs to the currently allowed tenant set.
   */
  req.assertTenantDocument = function assertTenantDocument(doc) {
    if (!doc || !req.tenantSiteIDs.length) return true;
    const docSiteID = doc.siteID || doc.site || null;
    return req.tenantSiteIDs.includes(docSiteID);
  };

  if (!isCorporateAdmin) {
    // Reject if non-admin user targets a site outside token site set.
    const attemptedSites = normalizeSites(
      req.params?.siteID,
      req.params?.siteId,
      req.params?.site,
      req.query?.siteID,
      req.query?.siteId,
      req.query?.site,
      req.body?.siteID,
      req.body?.siteId,
      req.body?.site,
      req.body?.siteIDs,
      req.body?.sites,
      selectedSite
    );

    const mismatch = attemptedSites.some(value => !tokenSiteIDs.includes(value));
    if (mismatch) {
      return res.status(403).json({ error: 'Forbidden: tenant mismatch' });
    }
  }

  // Normalize site identifiers in body for downstream routes.
  if (req.body && typeof req.body === 'object') {
    const effectiveSiteID = req.resolveTenantSiteID(req.body);
    if (effectiveSiteID) {
      req.body.siteID = effectiveSiteID;
      req.body.site = effectiveSiteID;
    }
  }

  next();
};
