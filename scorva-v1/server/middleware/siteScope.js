'use strict';

/**
 * siteScope middleware
 *
 * Sets req.siteFilter after requireAuth has verified the session:
 *   - Corporate Admin with no site selected  → null  (sees everything)
 *   - Corporate Admin with a site selected   → that site ID
 *   - Any other role                         → user's assigned site (forced)
 *
 * Route handlers use req.siteFilter like:
 *   const filter = req.siteFilter ? { site: req.siteFilter } : {};
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
