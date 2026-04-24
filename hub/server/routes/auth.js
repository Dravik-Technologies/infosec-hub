'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { db }  = require('../../../packages/db/src/index');
const { getAllowedApps, hasAppAccess } = require('../../../packages/db/src/appAccess');
const router  = express.Router();

function proxyLoginToScorva(username, password) {
  const scorvaBaseUrl = process.env.SCORVA_URL
    || `http://${process.env.SCORVA_HOST || '127.0.0.1'}:${parseInt(process.env.SCORVA_PORT || '3000', 10)}`;

  const loginUrl = new URL('/auth/login', scorvaBaseUrl);

  return fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
    .then(async res => {
      let parsed;
      try {
        parsed = await res.json();
      } catch {
        throw new Error('Bad response from SCORVA');
      }
      if (res.ok && parsed.user) return parsed.user;
      throw new Error(parsed.error || 'Invalid credentials');
    })
    .catch(err => {
      if (err.name === 'AbortError') throw new Error('SCORVA proxy timeout');
      throw err;
    });
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (process.env.NODE_ENV !== 'production' && username === 'admin' && password === 'admin') {
    req.session.user = {
      id: 'dev-admin', name: 'Dev Admin', username: 'admin',
      email: 'admin@dev.local', role: 'Corporate Admin',
      siteId: 'MTSI-ALX', siteIds: ['MTSI-ALX', 'MTSI-HVL'],
      site: 'MTSI-ALX', initials: 'DA', allowedApps: ['hub', 'scorva', 'crater', 'mash', 'lava'],
    };
    return res.json({ user: req.session.user });
  }

  // Primary: authenticate against shared PostgreSQL Users table
  try {
    const found = await db.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (!found || found.status !== 'Active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, found.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    if (!hasAppAccess(found, 'hub')) {
      return res.status(403).json({ error: 'Hub access has not been granted for this account' });
    }

    req.session.user = {
      id:       found.id,
      name:     found.name,
      username: found.username,
      email:    found.email,
      role:     found.role,
      siteId:   found.siteId,
      siteIds:  found.siteIds,
      site:     found.siteId,
      initials: found.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase(),
      allowedApps: getAllowedApps(found),
    };

    db.user.update({ where: { id: found.id }, data: { lastLogin: new Date() } }).catch(() => {});
    return res.json({ user: req.session.user });
  } catch (err) {
    // Fallback: proxy to SCORVA if database is unreachable
    if ((err.message && err.message.includes('connect')) || err.code === 'P1001') {
      try {
        console.log('[HUB] DB offline — proxying login to SCORVA');
        const scorvaUser = await proxyLoginToScorva(username, password);
        req.session.user = {
          id:       scorvaUser.id || scorvaUser._id,
          name:     scorvaUser.name,
          username: scorvaUser.username,
          email:    scorvaUser.email,
          role:     scorvaUser.role,
          siteId:   scorvaUser.siteId || scorvaUser.siteID || scorvaUser.site,
          siteIds:  scorvaUser.siteIds || scorvaUser.siteIDs || [],
          site:     scorvaUser.siteId || scorvaUser.siteID || scorvaUser.site,
          initials: scorvaUser.initials ||
                    scorvaUser.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase(),
        };
        return res.json({ user: req.session.user });
      } catch (proxyErr) {
        if (proxyErr.message === 'Invalid credentials') {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        return res.status(503).json({ error: 'Authentication service unavailable.' });
      }
    }
    console.error('[HUB] DB login error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('hub.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
