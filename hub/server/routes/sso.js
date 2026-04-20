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
const router      = express.Router();

const TTL_MS = (parseInt(process.env.SSO_TOKEN_TTL, 10) || 60) * 1000;

// In-memory token store: { [token]: { user, expires } }
const tokenStore = new Map();

// Purge expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [t, v] of tokenStore) {
    if (v.expires < now) tokenStore.delete(t);
  }
}, 5 * 60 * 1000);

/* POST /api/sso/token — authenticated hub user requests a launch token */
router.post('/token', (req, res, next) => {
  console.log(`[HUB SSO] /token called — session user: ${req.session?.user?.username ?? 'NONE'}`);
  next();
}, requireAuth, (req, res) => {
  const token   = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + TTL_MS;
  tokenStore.set(token, { user: req.session.user, expires });
  console.log(`[HUB SSO] token issued for ${req.session.user.username}`);
  res.json({ token, expires });
});

/* GET /api/sso/verify?token=<token> — called by external apps */
router.get('/verify', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token required' });
  }

  const entry = tokenStore.get(token);

  if (!entry) {
    return res.status(401).json({ valid: false, error: 'Token not found or already used' });
  }

  if (entry.expires < Date.now()) {
    tokenStore.delete(token);
    return res.status(401).json({ valid: false, error: 'Token expired' });
  }

  // One-time use — remove after verification
  tokenStore.delete(token);

  res.json({ valid: true, user: entry.user });
});

module.exports = router;
