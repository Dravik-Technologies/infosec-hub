'use strict';

require('dotenv').config();
require('./db');

const express  = require('express');
const path     = require('path');
const helmet   = require('helmet');
const cors     = require('cors');
const session  = require('express-session');

const requireAuth   = require('./middleware/requireAuth');
const authRouter    = require('./routes/auth');
const saarRouter    = require('./routes/saar');
const systemsRouter = require('./routes/systems');
const hardwareRouter = require('./routes/hardware');

const app   = express();
const PORT  = process.env.PORT || 3002;
const isDev = process.env.NODE_ENV !== 'production';
const secureCookies = process.env.COOKIE_SECURE === 'true'
  ? true
  : process.env.COOKIE_SECURE === 'false'
    ? false
    : !isDev;

app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

if (isDev) {
  app.use(cors({ origin: 'http://localhost:5175', credentials: true }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name:              'lava.sid',
  secret:            process.env.SESSION_SECRET || 'lava-devsecret-change-in-prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   secureCookies,
    sameSite: 'lax',
    maxAge:   8 * 60 * 60 * 1000,
  },
}));

app.use('/auth', authRouter);
app.use('/api/saar', saarRouter);
app.use('/api/systems', requireAuth, systemsRouter);
app.use('/api/hardware', requireAuth, hardwareRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'lava' }));

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error('[LAVA]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[LAVA] Access Portal running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
