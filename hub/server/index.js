'use strict';

require('dotenv').config();
require('./db');

const express    = require('express');
const path       = require('path');
const helmet     = require('helmet');
const cors       = require('cors');
const session    = require('express-session');
const MongoStore = require('connect-mongo');

const requireAuth = require('./middleware/requireAuth');
const authRouter  = require('./routes/auth');
const ssoRouter   = require('./routes/sso');

const app   = express();
const PORT  = process.env.PORT || 3010;
const isDev = process.env.NODE_ENV !== 'production';

/* ── Security headers ── */
app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

/* ── CORS (dev — Vite on :5174) ── */
if (isDev) {
  app.use(cors({ origin: 'http://localhost:5174', credentials: true }));
}

/* ── Body parsing ── */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ── Session ── */
const sessionStore = !isDev && process.env.MONGODB_URI
  ? MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: 'scorva',
      collectionName: 'hub_sessions',
      ttl: 8 * 60 * 60,
      autoRemove: 'native',
    })
  : undefined;

app.use(session({
  ...(sessionStore ? { store: sessionStore } : {}),
  name:              'hub.sid',
  secret:            process.env.SESSION_SECRET || 'hub-devsecret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   !isDev,
    sameSite: 'lax',
    maxAge:   8 * 60 * 60 * 1000,
  },
}));

/* ── Public auth routes ── */
app.use('/auth', authRouter);

/* ── /api/me ── */
app.get('/api/me', requireAuth, (req, res) => res.json(req.session.user));

/* ── SSO routes (token issue requires auth; verify is public) ── */
app.use('/api/sso', ssoRouter);

/* ── App registry — list of apps in the hub ── */
app.get('/api/apps', requireAuth, (_req, res) => {
  res.json(APPS);
});

/* ── Serve React build in production ── */
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

/* ── SPA fallback ── */
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

/* ── Global error handler ── */
app.use((err, _req, res, _next) => {
  console.error('[HUB]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[HUB] MTSI Security Hub running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

/* ── App registry data ── */
const APPS = [
  {
    id:      'scorva',
    name:    'SCORVA',
    tagline: 'Cyber Command Center',
    desc:    'NIST SP 800-53 Rev 5 compliance management — ATO tracking, continuous monitoring, POAM, asset inventory, and access governance.',
    url:     'http://localhost:3001',
    ssoPath: '/auth/sso',
    color:   'teal',
    icon:    'ShieldCheck',
    team:    'Cybersecurity',
    status:  'live',
    tags:    ['NIST 800-53', 'RMF', 'ATO', 'ConMon', 'POAM'],
  },
  {
    id:      'crater',
    name:    'CRATER',
    tagline: 'eMASS RMF Toolkit',
    desc:    'eMASS-aligned RMF package builder with SCTM, POAM management, vulnerability tracking, diagrams, and compliance reporting.',
    url:     'http://localhost:3003',
    ssoPath: '/sso.html',
    color:   'indigo',
    icon:    'FileText',
    team:    'GRC',
    status:  'live',
    tags:    ['eMASS', 'RMF', 'SCTM', 'POAM', 'Vulnerabilities'],
  },
  {
    id:      'mash',
    name:    'MASH',
    tagline: 'MTSI Advanced Sentinel Hub',
    desc:    'DoD security compliance dashboard with live threat intelligence, audit log analysis, and posture monitoring.',
    url:     'http://localhost:8080',
    ssoPath: '/auth/sso',
    color:   'gold',
    icon:    'BarChart3',
    team:    'Security Operations',
    status:  'live',
    tags:    ['Dashboard', 'Threat Intel', 'Compliance', 'DoD'],
  },
  {
    id:      'data-fabric',
    name:    'Data Fabric',
    tagline: 'CIM-ARC Data Platform',
    desc:    'CIM-ARC team portal featuring project reports, schedules, photo gallery, digital PMR, and team directory.',
    url:     'http://localhost:8081',
    ssoPath: '/sso',
    color:   'cyan',
    icon:    'Database',
    team:    'Data Engineering',
    status:  'live',
    tags:    ['CIM-ARC', 'Reports', 'PMR', 'Data'],
  },
];
