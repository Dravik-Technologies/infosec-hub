'use strict';

/**
 * Canonical site-tenantization helpers for SCORVA.
 *
 * Tenant rules (authoritative — from HUB identity model):
 *   - tenant unit      = siteId string
 *   - regular user     = scoped to siteId / siteIds only; cannot escape this scope
 *   - multi-site user  = may access any site in their siteIds array
 *   - enterprise user  = canSeeAllSites is true; may request any site or all-sites view
 *   - no site assigned = blocked from all operational data
 *
 * canSeeAllSites is true when HUB has determined:
 *   user.siteIds includes MTSI-ALX  AND
 *   (platformRole === 'Corporate Admin' OR securityRole === 'Corporate Security Admin')
 *
 * This module provides pure helper functions that are:
 *   - easily unit-testable (no Express request required except resolveTenantScope)
 *   - used by both middleware and route-level code
 *   - the single canonical source for tenant logic in SCORVA
 *
 * The Express middleware (tenantHandler, missionSiteScope) calls these helpers
 * internally. Route code can also call them directly for complex logic.
 *
 * Site-owned SCORVA entities (will need siteId — Phase B):
 *   ATOPackage, POAM, Control, ConMon, Agreement, Workstation, YubiKey, License,
 *   AuditLog, Tracker, Task (when site-specific), Threat
 *
 * Global/shared SCORVA entities (no siteId — always global):
 *   User (identity owned by HUB), Notification (platform-wide)
 *
 * @see docs/site-tenantization.md for full data classification
 */

/** Flatten and deduplicate site ID values from any mix of strings and arrays. */
function normalizeSiteIds(...values) {
  const flat = values.flatMap(v => Array.isArray(v) ? v : [v]);
  return [...new Set(flat.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

/**
 * Normalize the site scope from a user object.
 * Handles both lowercase (HUB model: siteId/siteIds) and legacy uppercase (siteID/siteIDs).
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
  // Honor explicit flag OR fall back to role check for legacy tokens
  const canSeeAllSites = Boolean(user.canSeeAllSites) || user.role === 'Corporate Admin';
  const securityRole = user.securityRole || null;
  return { siteId, siteIds, canSeeAllSites, securityRole };
}

/**
 * Determine the effective site filter for an Express request.
 * Reads user scope from req.user, and an optional ?siteId query param (or :siteId route param).
 *
 * Returns one of:
 *   { mode: 'single', siteId }   — query this specific site
 *   { mode: 'multi',  siteIds }  — query these sites (IN clause)
 *   { mode: 'all' }              — no filter; enterprise view
 *
 * Throws an Error with a .status property (403 or 400) on access violations.
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
 * Build a Prisma `where` clause that applies the resolved tenant scope.
 * Merges the site filter into an optional base where clause.
 *
 * Usage:
 *   const where = buildSiteWhere(resolveTenantScope(req), { status: 'Active' });
 *   const rows = await db.poam.findMany({ where });
 *
 * @param {{ mode: string, siteId?: string, siteIds?: string[] }} tenantScope
 * @param {object} base  Optional base Prisma where clause
 * @returns {object}
 */
function buildSiteWhere(tenantScope, base = {}) {
  if (!tenantScope || tenantScope.mode === 'all') return base;
  if (tenantScope.mode === 'single') return { ...base, siteId: tenantScope.siteId };
  if (tenantScope.mode === 'multi')  return { ...base, siteId: { in: tenantScope.siteIds } };
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
 * Assert that a user may access the siteId on a fetched document.
 * Returns false if the document is null or has no siteId the user can access.
 *
 * @param {object} user
 * @param {object|null} doc  Must have a .siteId property
 * @returns {boolean}
 */
function assertDocumentAccess(user, doc) {
  if (!doc) return false;
  const scope = getUserSiteScope(user);
  if (scope.canSeeAllSites) return true;
  return scope.siteIds.includes(doc.siteId || '');
}

/**
 * Return true when the request represents an enterprise (all-sites) view.
 * Only meaningful when user.canSeeAllSites is true — regular users never get this path.
 *
 * "Enterprise view" = canSeeAllSites AND no specific siteId requested.
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

/**
 * Resolve the target siteId for a write operation and validate user access.
 * Uses req.body.siteId first, then falls back to the user's primary siteId.
 *
 * Throws 400 if no siteId can be resolved.
 * Throws 403 if the user cannot access the resolved siteId.
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

module.exports = {
  normalizeSiteIds,
  getUserSiteScope,
  resolveTenantScope,
  buildSiteWhere,
  assertSiteAccess,
  assertDocumentAccess,
  isEnterpriseScopeRequest,
  resolveWriteSiteId,
};
