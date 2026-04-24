'use strict';

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const axios  = require('axios');
const { db } = require('../db');
const { hasAppAccess } = require('../../../packages/db/src/appAccess');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await db.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!hasAppAccess(user, 'lava')) return res.status(403).json({ error: 'LAVA access has not been provisioned for this account' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.status !== 'Active') return res.status(403).json({ error: 'Account inactive' });

    req.session.user = {
      id:      user.id,
      name:    user.name,
      username: user.username,
      email:   user.email,
      role:    user.role,
      siteId:  user.siteId,
      siteIds: user.siteIds,
    };

    res.json({ user: req.session.user });
  } catch (err) {
    console.error('[LAVA/auth] login error', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!(req.session && req.session.user)) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.session.user);
});

// Hub SSO callback
router.get('/sso', async (req, res) => {
  const { hub_token } = req.query;
  if (!hub_token) return res.redirect('/?error=no_token');

  try {
    const hubUrl = process.env.HUB_URL || 'http://localhost:3010';
    const { data } = await axios.get(`${hubUrl}/api/sso/verify?token=${hub_token}`);
    if (!data.valid) return res.redirect('/?error=invalid_token');
    if (data.user.requestedApp && data.user.requestedApp !== 'lava') {
      return res.redirect('/?error=invalid_sso_target');
    }

    const localUser = await db.user.findUnique({
      where: { username: String(data.user.username || '').toLowerCase().trim() },
    });
    if (!localUser || localUser.status !== 'Active' || !hasAppAccess(localUser, 'lava')) {
      return res.redirect('/?error=lava_access_required');
    }

    req.session.user = {
      id:      localUser.id,
      name:    localUser.name,
      username: localUser.username,
      email:   localUser.email,
      role:    localUser.role,
      siteId:  localUser.siteId,
      siteIds: localUser.siteIds,
    };

    res.redirect('/');
  } catch (err) {
    console.error('[LAVA/auth] SSO error', err.message);
    res.redirect('/?error=sso_failed');
  }
});

module.exports = router;
