'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const http    = require('http');
const { db }  = require('../../../packages/db/src/index');
const router  = express.Router();

function proxyLoginToScorva(username, password) {
  const SCORVA_HOST = process.env.SCORVA_HOST || '127.0.0.1';
  const SCORVA_PORT = parseInt(process.env.SCORVA_PORT || '3000', 10);
  const body        = JSON.stringify({ username, password });

  return new Promise((resolve, reject) => {
    let settled = false;
    function settle(fn, val) { if (!settled) { settled = true; fn(val); } }

    const req = http.request(
      { hostname: SCORVA_HOST, port: SCORVA_PORT, path: '/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode === 200 && parsed.user) settle(resolve, parsed.user);
            else settle(reject, new Error(parsed.error || 'Invalid credentials'));
          } catch {
            settle(reject, new Error('Bad response from SCORVA'));
          }
        });
        res.on('error', e => settle(reject, e));
      }
    );
    const timer = setTimeout(() => {
      settle(reject, new Error('SCORVA proxy timeout'));
      req.destroy();
    }, 12000);
    req.on('error', e => { clearTimeout(timer); settle(reject, e); });
    req.on('close', () => clearTimeout(timer));
    req.write(body);
    req.end();
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
      site: 'MTSI-ALX', initials: 'DA',
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
    };

    db.user.update({ where: { id: found.id }, data: { lastLogin: new Date() } }).catch(() => {});
    return res.json({ user: req.session.user });
  } catch (err) {
    // Fallback: proxy to SCORVA if database is unreachable
    if (err.message?.includes('connect') || err.code === 'P1001') {
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
