'use strict';

/**
 * SSO Token Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements a simple single-sign-on token exchange so apps outside the hub
 * can validate that a user already authenticated with the hub.
 *
 * Flow:
 *   1. Hub user clicks "Launch" on an app card.
 *   2. Client calls  POST /api/sso/token  →  { token, expires }
 *   3. Browser is redirected to app URL with ?hub_token=<token>
 *   4. App backend calls  GET /api/sso/verify?token=<token>
 *      →  { valid: true, user: { ... } }
 *
 * Tokens are one-time-use, stored in-memory, and expire after SSO_TOKEN_TTL
 * seconds (default 60 s).  In production, replace the in-memory store with
 * Redis or a short-TTL MongoDB collection.
 */

const express     = require('express');
const crypto      = require('crypto');
const requireAuth = require('../middleware/requireAuth');
const { hasAppAccess, getLegacyPlatformRole } = require('../../../packages/db/src/appAccess');
const { db } = require('../../../packages/db/src');
const router      = express.Router();

const TTL_MS = (parseInt(process.env.SSO_TOKEN_TTL, 10) || 60) * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildLaunchUser(sessionUser, appId) {
  const hubRole = sessionUser.hubRole || sessionUser.role;
  const jobRole = sessionUser.jobRole || sessionUser.securityRole || null;
  const primarySiteId = sessionUser.primarySiteId || sessionUser.siteId || sessionUser.site || null;
  const siteIds = Array.isArray(sessionUser.siteIds) ? sessionUser.siteIds : [];
  const allowedApps = Array.isArray(sessionUser.allowedApps) ? sessionUser.allowedApps : [];

  return {
    ...sessionUser,
    authVersion: sessionUser.authVersion || 3,
    hubRole,
    jobRole,
    primarySiteId,
    siteIds,
    allowedApps,
    requestedApp: appId,

    // Legacy compatibility fields for apps not yet migrated to the new contract.
    role: getLegacyPlatformRole(hubRole),
    siteId: primarySiteId,
    site: primarySiteId,
    securityRole: jobRole,
  };
}

// Cleanup expired tokens in the database every 10 minutes
setInterval(async () => {
  try {
    await db.hubSsoToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch (err) {
    console.error('[HUB SSO cleanup]', err.message);
  }
}, 10 * 60 * 1000);

/* POST /api/sso/token — authenticated hub user requests a launch token */
router.post('/token', (req, res, next) => {
  const sessionUser = req.session && req.session.user ? req.session.user.username : 'NONE';
  console.log(`[HUB SSO] /token called — session user: ${sessionUser}`);
  next();
}, requireAuth, async (req, res) => {
  const appId = String((req.body && req.body.appId) || '').trim().toLowerCase();
  if (!appId) {
    return res.status(400).json({ error: 'appId is required' });
  }
  if (!hasAppAccess(req.session.user, appId)) {
    return res.status(403).json({ error: `Access to ${appId} has not been granted` });
  }
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TTL_MS);
    const userData = buildLaunchUser(req.session.user, appId);

    await db.hubSsoToken.create({
      data: {
        tokenHash,
        userData,
        expiresAt,
      },
    });

    console.log(`[HUB SSO] token issued for ${req.session.user.username} -> ${appId}`);
    res.json({ token, expires: expiresAt.getTime(), appId });
  } catch (err) {
    console.error('[HUB SSO /token]', err.message);
    res.status(500).json({ error: 'Unable to issue token' });
  }
});

/* GET /api/sso/verify?token=<token> — called by external apps */
router.get('/verify', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token required' });
  }

  try {
    const tokenHash = hashToken(token);
    const entry = await db.hubSsoToken.findUnique({
      where: { tokenHash },
    });

    if (!entry) {
      return res.status(401).json({ valid: false, error: 'Token not found or already used' });
    }

    if (entry.consumedAt) {
      return res.status(401).json({ valid: false, error: 'Token already consumed' });
    }

    if (entry.expiresAt < new Date()) {
      return res.status(401).json({ valid: false, error: 'Token expired' });
    }

    // Mark as consumed (one-time use)
    await db.hubSsoToken.update({
      where: { tokenHash },
      data: { consumedAt: new Date() },
    });

    res.json({ valid: true, user: entry.userData });
  } catch (err) {
    console.error('[HUB SSO /verify]', err.message);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

module.exports = router;
