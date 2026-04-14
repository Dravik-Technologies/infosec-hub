'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const mongoose = require('mongoose');
const http     = require('http');
const User     = require('../models/User');
const router   = express.Router();

/** Check whether mongoose is actively connected. */
function dbReady() {
  return mongoose.connection.readyState === 1;
}

/**
 * Proxy login to the scorva-v1 server when the hub's own DB connection is
 * unavailable.  Returns the scorva user object on success, throws on failure.
 *
 * scorva-v1 stores its session in its own cookie, so we only use the returned
 * user payload to build the hub session — no cross-cookie sharing needed.
 */
function proxyLoginToScorva(username, password) {
  const SCORVA_HOST = process.env.SCORVA_HOST || '127.0.0.1';
  const SCORVA_PORT = parseInt(process.env.SCORVA_PORT || '3000', 10);
  const body        = JSON.stringify({ username, password });

  return new Promise((resolve, reject) => {
    let settled = false;
    function settle(fn, val) {
      if (!settled) { settled = true; fn(val); }
    }

    const req = http.request(
      {
        hostname: SCORVA_HOST,
        port:     SCORVA_PORT,
        path:     '/auth/login',
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode === 200 && parsed.user) {
              settle(resolve, parsed.user);
            } else {
              settle(reject, new Error(parsed.error || 'Invalid credentials'));
            }
          } catch {
            console.error('[HUB] SCORVA raw response (parse failed):', data.slice(0, 200));
            settle(reject, new Error('Bad response from SCORVA'));
          }
        });
        res.on('error', err => settle(reject, err));
      }
    );

    // 12-second timeout — SCORVA may itself be waiting on MongoDB (10 s buffer)
    const timer = setTimeout(() => {
      settle(reject, new Error('SCORVA proxy timeout — ensure SCORVA server is running'));
      req.destroy();
    }, 12000);

    req.on('error', err => {
      clearTimeout(timer);
      settle(reject, err);
    });
    req.on('close', () => clearTimeout(timer));

    req.write(body);
    req.end();
  });
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* POST /auth/login                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // ── Dev bypass (admin/admin, no DB needed) ──
  if (process.env.NODE_ENV !== 'production' &&
      username === 'admin' && password === 'admin') {
    req.session.user = {
      id:       'dev-admin',
      name:     'Dev Admin',
      username: 'admin',
      email:    'admin@dev.local',
      role:     'Corporate Admin',
      site:     'SITE-001',
      initials: 'DA',
    };
    return res.json({ user: req.session.user });
  }

  // ── Primary path: authenticate against hub's own MongoDB ──
  if (dbReady()) {
    try {
      const user = await User.findOne({ username: username.toLowerCase().trim() })
        .select('+password_hash');

      if (!user || user.status !== 'Active') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      req.session.user = {
        id:       user._id,
        name:     user.name,
        username: user.username,
        email:    user.email,
        role:     user.role,
        site:     user.site,
        initials: user.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase(),
      };

      // Fire-and-forget — don't block the response
      User.findByIdAndUpdate(user._id, { last_login: new Date().toISOString() }).catch(() => {});

      return res.json({ user: req.session.user });
    } catch (err) {
      console.error('[HUB] DB login error:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ── Fallback: proxy to SCORVA (uses same user DB) ──
  try {
    console.log('[HUB] DB offline — proxying login to SCORVA');
    const scorvaUser = await proxyLoginToScorva(username, password);

    req.session.user = {
      id:       scorvaUser.id || scorvaUser._id,
      name:     scorvaUser.name,
      username: scorvaUser.username,
      email:    scorvaUser.email,
      role:     scorvaUser.role,
      site:     scorvaUser.site,
      initials: scorvaUser.initials ||
                scorvaUser.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase(),
    };

    return res.json({ user: req.session.user });
  } catch (err) {
    console.error('[HUB] Proxy login error:', err.message);

    // Surface a meaningful message to the UI
    if (err.message === 'Invalid credentials') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.status(503).json({
      error: 'Authentication service unavailable. Please ensure the database or SCORVA server is running.',
    });
  }
});

/* POST /auth/logout */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('hub.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
