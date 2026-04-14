'use strict';

/**
 * requireAuth — Express middleware
 * Rejects unauthenticated requests to /api/* with 401.
 * For non-API routes the caller (index.js) handles the redirect.
 */
module.exports = function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  // API consumers get JSON, not a redirect
  res.status(401).json({ error: 'Unauthorized' });
};
