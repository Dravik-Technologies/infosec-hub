'use strict';

require('dotenv').config();
require('./db'); // Connect to MongoDB

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const requireAuth = require('./middleware/requireAuth');
const tenantHandler = require('./middleware/tenantHandler');
const missionSiteScope = require('./middleware/missionSiteScope');

// API routers
const authRouter = require('./routes/auth');
const conmonRouter = require('./routes/conmon');
const controlsRouter = require('./routes/controls');
const tasksRouter = require('./routes/tasks');
const poamRouter = require('./routes/poam');
const atoRouter = require('./routes/ato');
const workstationsRouter = require('./routes/workstations');
const yubikeysRouter = require('./routes/yubikeys');
const usersRouter = require('./routes/users');
const agreementsRouter = require('./routes/agreements');
const licensesRouter = require('./routes/licenses');
const auditRouter = require('./routes/audit');
const trackersRouter = require('./routes/trackers');
const notificationsRouter = require('./routes/notifications');
const sitesRouter = require('./routes/sites');
const threatsRouter = require('./routes/threats');

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

/* Security headers */
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: false,
}));

/* CORS (dev only — Vite runs on :5173) */
if (isDev) {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }));
}

/* Body parsing */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

/* Legacy session fallback; JWT is now primary auth mechanism */
const sessionStore = !isDev && process.env.MONGODB_URI
  ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, dbName: 'scorva', ttl: 8 * 60 * 60, autoRemove: 'native' })
  : undefined;

app.use(session({
  ...(sessionStore ? { store: sessionStore } : {}),
  secret: process.env.SESSION_SECRET || 'devsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: !isDev,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

/* Auth routes (public) */
app.use('/auth', authRouter);

/* Dev fallback: return empty data when DB is unreachable */
if (isDev) {
  const mongoose = require('mongoose');
  app.use('/api', (req, res, next) => {
    if (mongoose.connection.readyState !== 1 && req.method === 'GET' && req.path !== '/me') {
      return res.json([]);
    }
    next();
  });
}

/* Protected API routes */
app.use('/api/conmon', requireAuth, tenantHandler, conmonRouter);
app.use('/api/tasks', requireAuth, tenantHandler, tasksRouter);
app.use('/api/poam', requireAuth, tenantHandler, missionSiteScope, poamRouter);
app.use('/api/ato', requireAuth, tenantHandler, missionSiteScope, atoRouter);
app.use('/api/agreements', requireAuth, tenantHandler, missionSiteScope, agreementsRouter);
app.use('/api/trackers', requireAuth, tenantHandler, trackersRouter);
app.use('/api/users', requireAuth, tenantHandler, usersRouter);
app.use('/api/controls', requireAuth, tenantHandler, missionSiteScope, controlsRouter);
app.use('/api/workstations', requireAuth, tenantHandler, missionSiteScope, workstationsRouter);
app.use('/api/yubikeys', requireAuth, tenantHandler, missionSiteScope, yubikeysRouter);
app.use('/api/licenses', requireAuth, tenantHandler, missionSiteScope, licensesRouter);
app.use('/api/audit', requireAuth, tenantHandler, missionSiteScope, auditRouter);
app.use('/api/notifications', requireAuth, tenantHandler, notificationsRouter);
app.use('/api/sites', requireAuth, sitesRouter);
app.use('/api/threats', requireAuth, threatsRouter);

/* Mission Apps API namespace (same routers, strict site isolation middleware) */
app.use('/api/mission-apps/authorization/ato', requireAuth, tenantHandler, missionSiteScope, atoRouter);
app.use('/api/mission-apps/authorization/controls', requireAuth, tenantHandler, missionSiteScope, controlsRouter);
app.use('/api/mission-apps/authorization/poam', requireAuth, tenantHandler, missionSiteScope, poamRouter);
app.use('/api/mission-apps/assets/devices', requireAuth, tenantHandler, missionSiteScope, workstationsRouter);
app.use('/api/mission-apps/assets/yubikeys', requireAuth, tenantHandler, missionSiteScope, yubikeysRouter);
app.use('/api/mission-apps/assets/licenses', requireAuth, tenantHandler, missionSiteScope, licensesRouter);
app.use('/api/mission-apps/admin/documents', requireAuth, tenantHandler, missionSiteScope, agreementsRouter);
app.use('/api/mission-apps/admin/audit', requireAuth, tenantHandler, missionSiteScope, auditRouter);

/* /api/me — return normalized user identity from JWT/session */
app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

/* Serve React build in production */
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

/* SPA fallback */
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

/* Global error handler */
app.use((err, _req, res, _next) => {
  console.error('[SCORVA]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[SCORVA] Server on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
