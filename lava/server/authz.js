'use strict';

// Platform admin roles — full LAVA admin/operator access
const PLATFORM_ADMIN_ROLES = new Set(['Corporate Admin', 'Hub Admin', 'Site Admin', 'Admin']);

// Security roles that grant LAVA operator access
const OPERATOR_SECURITY_ROLES = new Set(['Information Technology', 'Information Security']);

// Legacy compatibility — kept to avoid breaking existing Vulcan-role accounts during migration
const LEGACY_VULCAN_ROLES = new Set(['Vulcan']);

function isVulcanUser(req) {
  const user = req.session && req.session.user;
  if (!user) return false;
  return PLATFORM_ADMIN_ROLES.has(user.role)
    || OPERATOR_SECURITY_ROLES.has(user.securityRole)
    || LEGACY_VULCAN_ROLES.has(user.role);
}

function requireVulcan(req, res, next) {
  if (isVulcanUser(req)) return next();
  return res.status(403).json({ error: 'LAVA operator access required' });
}

function isCorporateAdmin(req) {
  const user = req.session && req.session.user;
  return Boolean(user && (user.role === 'Corporate Admin' || user.role === 'Hub Admin'));
}

function requireCorporateAdmin(req, res, next) {
  if (isCorporateAdmin(req)) return next();
  return res.status(403).json({ error: 'Corporate Admin access required' });
}

// Returns true if viewer may access a record whose siteId is recordSiteId.
// null/undefined recordSiteId = enterprise-wide record, always accessible.
// Corporate Admin / canSeeAllSites = unrestricted.
// Otherwise the record's siteId must be in the viewer's allowed site list.
function isSiteAllowed(viewer, recordSiteId) {
  if (!viewer) return false;
  if (viewer.role === 'Corporate Admin' || viewer.role === 'Hub Admin' || viewer.canSeeAllSites) return true;
  if (recordSiteId === null || recordSiteId === undefined) return true;
  const siteIds = Array.isArray(viewer.siteIds) ? viewer.siteIds.filter(Boolean) : [];
  if (viewer.siteId && !siteIds.includes(viewer.siteId)) siteIds.push(viewer.siteId);
  return siteIds.includes(recordSiteId);
}

module.exports = { isVulcanUser, requireVulcan, isCorporateAdmin, requireCorporateAdmin, isSiteAllowed };
