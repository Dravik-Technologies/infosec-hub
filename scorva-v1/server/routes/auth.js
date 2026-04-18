'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const audit = require('../middleware/audit');
const requireAuth = require('../middleware/requireAuth');
const { signAccessToken } = require('../middleware/jwt');

const router = express.Router();

/**
 * Builds the canonical user object sent to the frontend and encoded in JWT.
 */
function toAuthUser(rawUser) {
  const initials = (rawUser.name || '')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const siteIDs = Array.isArray(rawUser.siteIDs) && rawUser.siteIDs.length
    ? rawUser.siteIDs.filter(Boolean)
    : [rawUser.siteID || rawUser.site].filter(Boolean);
  const siteID = rawUser.siteID || rawUser.site || siteIDs[0] || null;

  return {
    id: rawUser.id || rawUser._id,
    name: rawUser.name,
    username: rawUser.username,
    email: rawUser.email || null,
    role: rawUser.role,
    siteID,
    siteIDs,
    site: siteID,
    initials: rawUser.initials || initials,
  };
}

/* POST /auth/login — JSON body { username, password } */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // DEV BYPASS — hardcoded credentials when DB is unavailable (development only)
  if (process.env.NODE_ENV !== 'production' && username === 'admin' && password === 'admin') {
    const user = toAuthUser({
      id: 'dev-admin',
      name: 'Dev Admin',
      username: 'admin',
      email: 'admin@dev.local',
      role: 'Corporate Admin',
      siteID: 'MTSI-ALX',
      siteIDs: [],
      initials: 'DA',
    });
    const token = signAccessToken(user);
    return res.json({ token, user });
  }

  try {
    const found = await User.findOne({ username: username.toLowerCase().trim() }).select('+password_hash');

    if (!found || found.status !== 'Active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, found.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = toAuthUser(found);
    const token = signAccessToken(user);

    await User.findByIdAndUpdate(found._id, {
      last_login: new Date().toISOString(),
    });

    await audit(user.username, 'LOGIN', 'System', 'Successful login', user.siteID);

    res.json({ token, user });
  } catch (err) {
    console.error('[SCORVA] Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /auth/sso?hub_token=<token> — hub SSO handoff */
router.get('/sso', async (req, res) => {
  const { hub_token } = req.query;
  if (!hub_token) return res.redirect('/');
  try {
    const hubUrl = process.env.HUB_URL || 'http://localhost:3010';
    const r = await fetch(`${hubUrl}/api/sso/verify?token=${encodeURIComponent(String(hub_token))}`);
    const body = await r.json();
    if (!r.ok || !body.valid) return res.redirect('/');

    const user = toAuthUser({
      id: body.user.id,
      name: body.user.name,
      username: body.user.username,
      email: body.user.email,
      role: body.user.role,
      siteID: body.user.siteID || body.user.site,
      initials: body.user.initials,
    });

    const token = signAccessToken(user);
    // Keep legacy SSO behavior by hydrating server session too.
    req.session.user = user;
    req.session.save(err => {
      if (err) console.error('[SCORVA SSO] session save error:', err.message);
      res.redirect(`/?token=${encodeURIComponent(token)}`);
    });
  } catch (err) {
    console.error('[SCORVA SSO]', err.message);
    res.redirect('/');
  }
});

/* POST /auth/select-site — Corporate Admin only; { siteId: 'MTSI-ALX' | null } */
router.post('/select-site', requireAuth, (req, res) => {
  if (req.user.role !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const selectedSite = req.body.siteId || req.body.siteID || null;
  res.json({ selectedSite });
});

/* POST /auth/logout */
router.post('/logout', requireAuth, async (req, res) => {
  await audit(req.user.username, 'LOGOUT', 'System', 'User logged out', req.user.siteID || null);
  res.json({ ok: true });
});

module.exports = router;
