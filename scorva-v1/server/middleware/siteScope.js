'use strict';

/**
 * @deprecated siteScope reads from req.session and does not support the
 * canSeeAllSites flag or multi-site users. It is retained only for any
 * remaining legacy session-auth routes that have not yet migrated to JWT.
 *
 * New routes should use tenantHandler (multi-site) or missionSiteScope
 * (strict single-site), both of which use req.user populated by requireAuth.
 *
 * TODO(Phase B): audit all usages of this middleware and migrate to tenantHandler.
 */
module.exports = function siteScope(req, res, next) {
  const user = req.session.user;
  if (user.role === 'Corporate Admin') {
    req.siteFilter = req.session.selectedSite || null;
  } else {
    req.siteFilter = user.site || null;
  }
  next();
};
