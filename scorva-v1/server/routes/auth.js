'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');
const audit    = require('../middleware/audit');
const router   = express.Router();

/* POST /auth/login — JSON body { username, password } */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // DEV BYPASS — hardcoded credentials when DB is unavailable (development only)
  if (process.env.NODE_ENV !== 'production' &&
      username === 'admin' && password === 'admin') {
    req.session.user = {
      id: 'dev-admin',
      name: 'Dev Admin',
      username: 'admin',
      email: 'admin@dev.local',
      role: 'Corporate Admin',
      site: 'SITE-001',
      initials: 'DA',
    };
    return res.json({ user: req.session.user });
  }

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

    await User.findByIdAndUpdate(user._id, {
      last_login: new Date().toISOString(),
    });

    await audit(user.username, 'LOGIN', 'System', 'Successful login', user.site);

    res.json({ user: req.session.user });
  } catch (err) {
    console.error('[SCORVA] Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /auth/logout */
router.post('/logout', (req, res) => {
  const username = req.session.user?.username;
  req.session.destroy(async () => {
    if (username) {
      await audit(username, 'LOGOUT', 'System', 'User logged out');
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
