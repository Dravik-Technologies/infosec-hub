'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../../packages/db/src/index');
const audit = require('../middleware/audit');
const requireAuth = require('../middleware/requireAuth');
const { signAccessToken } = require('../middleware/jwt');

const router = express.Router();

function toAuthUser(u) {
  const initials = (u.name || '')
    .split(' ').filter(Boolean).map(p => p[0]).join('').substring(0, 2).toUpperCase();

  const siteIds = Array.isArray(u.siteIds) && u.siteIds.length
    ? u.siteIds.filter(Boolean)
    : [u.siteId].filter(Boolean);
  const siteId = u.siteId || siteIds[0] || null;

  return {
    id:       u.id,
    name:     u.name,
    username: u.username,
    email:    u.email || null,
    role:     u.role,
    siteID:   siteId,   // keep legacy key for frontend / JWT consumers
    siteIDs:  siteIds,
    siteId,
    siteIds,
    site:     siteId,
    initials: u.initials || initials,
  };
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (process.env.NODE_ENV !== 'production' && username === 'admin' && password === 'admin') {
    const user = toAuthUser({
      id: 'dev-admin', name: 'Dev Admin', username: 'admin',
      email: 'admin@dev.local', role: 'Corporate Admin',
      siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX', 'MTSI-HVL'], initials: 'DA',
    });
    return res.json({ token: signAccessToken(user), user });
  }

  try {
    const found = await db.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (!found || found.status !== 'Active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, found.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const user  = toAuthUser(found);
    const token = signAccessToken(user);

    await db.user.update({ where: { id: found.id }, data: { lastLogin: new Date() } });
    await audit(user.username, 'LOGIN', 'System', 'Successful login', user.siteId);

    res.json({ token, user });
  } catch (err) {
    console.error('[SCORVA] Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/sso', async (req, res) => {
  const { hub_token } = req.query;
  if (!hub_token) { console.log('[SCORVA SSO] no hub_token'); return res.redirect('/'); }
  try {
    const hubUrl = process.env.HUB_URL || 'http://localhost:3010';
    console.log(`[SCORVA SSO] verifying token with hub at ${hubUrl}`);
    const r = await fetch(`${hubUrl}/api/sso/verify?token=${encodeURIComponent(String(hub_token))}`);
    const body = await r.json();
    console.log(`[SCORVA SSO] hub response: status=${r.status} valid=${body.valid} user=${body.user?.username ?? 'none'}`);
    if (!r.ok || !body.valid) { console.log('[SCORVA SSO] verification failed'); return res.redirect('/'); }

    const user = toAuthUser({
      id:       body.user.id,
      name:     body.user.name,
      username: body.user.username,
      email:    body.user.email,
      role:     body.user.role,
      siteId:   body.user.siteId || body.user.siteID || body.user.site,
      siteIds:  body.user.siteIds || body.user.siteIDs || [],
      initials: body.user.initials,
    });

    const token = signAccessToken(user);
    req.session.user = user;
    req.session.save(err => {
      if (err) console.error('[SCORVA SSO] session save error:', err.message);
      res.redirect(`/portal?token=${encodeURIComponent(token)}`);
    });
  } catch (err) {
    console.error('[SCORVA SSO]', err.message);
    res.redirect('/');
  }
});

router.post('/select-site', requireAuth, (req, res) => {
  if (req.user.role !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const selectedSite = req.body.siteId || req.body.siteID || null;
  res.json({ selectedSite });
});

router.post('/logout', requireAuth, async (req, res) => {
  await audit(req.user.username, 'LOGOUT', 'System', 'User logged out', req.user.siteId || req.user.siteID || null);
  res.json({ ok: true });
});

module.exports = router;
