'use strict';

/**
 * Canonical site-tenantization helpers for MASH (security-dashboard).
 *
 * Tenant rules (authoritative — from HUB identity model):
 *   - tenant unit      = siteId string
 *   - regular user     = scoped to siteId / siteIds only
 *   - multi-site user  = may access any site in their siteIds array
 *   - enterprise user  = canSeeAllSites is true; may request any site or all-sites view
 *   - no site assigned = blocked from all operational data
 *
 * canSeeAllSites is true when HUB has determined:
 *   user.siteIds includes MTSI-ALX  AND
 *   (platformRole === 'Hub Admin' OR platformRole === 'Corporate Admin' OR securityRole === 'Corporate Security Admin')
 *
 * MASH JWT is issued by this server at /api/auth/login (proxied from HUB).
 * The payload is { ...hubUser, wsRole }, so siteId, siteIds, canSeeAllSites,
 * and securityRole are all present when coming through the current login path.
 *
 * Site-owned MASH collections (JSON store — transitioning to relational in Phase C):
 *   facility_security, personnel_security, activities_security,
 *   document_control, media_control, self_inspection_ops, security_findings
 *
 * Global/singleton collections (not site-scoped — no tenant filter applied):
 *   security_workspace_settings, workspace_role_mappings
 *
 * @see docs/site-tenantization.md for full data classification and Phase C plan
 */

/** Site-owned operational collections — tenant scope enforced on all CRUD. */
const SITE_OWNED_COLLECTIONS = new Set([
  'facility_security',
  'personnel_security',
  'activities_security',
  'document_control',
  'media_control',
  'self_inspection_ops',
  'security_findings',
]);

/** Global/singleton collections — no tenant filter; accessible to all authenticated users. */
const GLOBAL_COLLECTIONS = new Set([
  'security_workspace_settings',
  'workspace_role_mappings',
]);

/** Flatten and deduplicate site ID values from any mix of strings and arrays. */
function normalizeSiteIds(...values) {
  const flat = values.flatMap(v => Array.isArray(v) ? v : [v]);
  return [...new Set(flat.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

/**
 * Normalize the site scope from a user object (JWT payload or session user).
 * Handles both lowercase (HUB model: siteId/siteIds) and uppercase (siteID/siteIDs).
 *
 * @param {object|null} user
 * @returns {{ siteId: string|null, siteIds: string[], canSeeAllSites: boolean, securityRole: string|null }}
 */
function getUserSiteScope(user) {
  if (!user) {
    return { siteId: null, siteIds: [], canSeeAllSites: false, securityRole: null };
  }
  const siteIds = normalizeSiteIds(
    user.siteIds, user.siteIDs, user.siteId, user.siteID, user.site
  );
  const siteId = user.siteId || user.siteID || user.site || siteIds[0] || null;
  const canSeeAllSites = Boolean(user.canSeeAllSites) || user.role === 'Corporate Admin' || user.role === 'Hub Admin';
  const securityRole = user.securityRole || null;
  return { siteId, siteIds, canSeeAllSites, securityRole };
}

/**
 * Determine the effective site filter for an Express request.
 * For site-owned collections, call this at the start of the route handler.
 *
 * Returns one of:
 *   { mode: 'single', siteId }   — filter to this site
 *   { mode: 'multi',  siteIds }  — filter to these sites
 *   { mode: 'all' }              — no filter; enterprise view
 *
 * Throws an Error with .status (403 or 400) on access violations.
 *
 * @param {import('express').Request} req
 * @returns {{ mode: 'single'|'multi'|'all', siteId?: string, siteIds?: string[] }}
 */
function resolveTenantScope(req) {
  const scope = getUserSiteScope(req.user);
  const requestedSiteId = (req.query?.siteId || req.params?.siteId || '').trim() || null;

  if (scope.canSeeAllSites) {
    if (requestedSiteId) return { mode: 'single', siteId: requestedSiteId };
    return { mode: 'all' };
  }

  if (!scope.siteIds.length) {
    const err = new Error('No site access assigned');
    err.status = 403;
    throw err;
  }

  if (requestedSiteId) {
    if (!scope.siteIds.includes(requestedSiteId)) {
      const err = new Error(`Site access denied: ${requestedSiteId}`);
      err.status = 403;
      throw err;
    }
    return { mode: 'single', siteId: requestedSiteId };
  }

  if (scope.siteIds.length === 1) {
    return { mode: 'single', siteId: scope.siteIds[0] };
  }
  return { mode: 'multi', siteIds: scope.siteIds };
}

/**
 * Apply a resolved tenant scope to a JSON array (MASH collection items).
 * For Prisma queries (Phase C), use buildSiteWhere instead.
 *
 * @param {any[]} items
 * @param {{ mode: string, siteId?: string, siteIds?: string[] }} scope
 * @returns {any[]}
 */
function applyScopeFilter(items, scope) {
  if (!Array.isArray(items)) return items;
  if (!scope || scope.mode === 'all') return items;
  if (scope.mode === 'single') return items.filter(i => i.siteId === scope.siteId);
  if (scope.mode === 'multi')  return items.filter(i => scope.siteIds.includes(i.siteId));
  return items;
}

/**
 * Build a Prisma `where` clause for the resolved tenant scope.
 * For use in Phase C when MASH collections become relational.
 *
 * @param {{ mode: string, siteId?: string, siteIds?: string[] }} scope
 * @param {object} base  Optional base where clause
 * @returns {object}
 */
function buildSiteWhere(scope, base = {}) {
  if (!scope || scope.mode === 'all') return base;
  if (scope.mode === 'single') return { ...base, siteId: scope.siteId };
  if (scope.mode === 'multi')  return { ...base, siteId: { in: scope.siteIds } };
  return base;
}

/**
 * Assert that a user may access a specific siteId.
 *
 * @param {object} user
 * @param {string} siteId
 * @returns {boolean}
 */
function assertSiteAccess(user, siteId) {
  if (!user || !siteId) return false;
  const scope = getUserSiteScope(user);
  if (scope.canSeeAllSites) return true;
  return scope.siteIds.includes(siteId);
}

/**
 * Resolve the target siteId for a write operation and validate user access.
 * Uses req.body.siteId first, then falls back to the user's primary siteId.
 *
 * Throws 400 if no siteId can be resolved.
 * Throws 403 if the user cannot write to the resolved siteId.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function resolveWriteSiteId(req) {
  const bodySiteId = (req.body?.siteId || req.body?.siteID || '').trim() || null;
  const scope = getUserSiteScope(req.user);

  const target = bodySiteId || scope.siteId;
  if (!target) {
    const err = new Error('siteId is required for write operations on site-owned records');
    err.status = 400;
    throw err;
  }
  if (!assertSiteAccess(req.user, target)) {
    const err = new Error(`Site access denied: ${target}`);
    err.status = 403;
    throw err;
  }
  return target;
}

/**
 * Return true when the request represents an enterprise (all-sites) view.
 * Only meaningful when user.canSeeAllSites is true.
 *
 * @param {import('express').Request} req
 * @param {object} [user]  Defaults to req.user
 * @returns {boolean}
 */
function isEnterpriseScopeRequest(req, user) {
  const scope = getUserSiteScope(user || req.user);
  if (!scope.canSeeAllSites) return false;
  const requestedSiteId = (req.query?.siteId || req.params?.siteId || '').trim();
  return !requestedSiteId;
}

module.exports = {
  SITE_OWNED_COLLECTIONS,
  GLOBAL_COLLECTIONS,
  normalizeSiteIds,
  getUserSiteScope,
  resolveTenantScope,
  applyScopeFilter,
  buildSiteWhere,
  assertSiteAccess,
  resolveWriteSiteId,
  isEnterpriseScopeRequest,
};
