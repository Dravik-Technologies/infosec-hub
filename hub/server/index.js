'use strict';

require('dotenv').config();
require('./db');

const express    = require('express');
const path       = require('path');
const helmet     = require('helmet');
const cors       = require('cors');
const session    = require('express-session');
const { getSessionStore } = require('./sessionStore');

const requireAuth = require('./middleware/requireAuth');
const authRouter  = require('./routes/auth');
const adminRouter = require('./routes/admin');
const accessRequestRouter = require('./routes/accessRequests');
const ssoRouter   = require('./routes/sso');
const { hasAppAccess } = require('../../packages/db/src/appAccess');

const app   = express();
const PORT  = process.env.PORT || 3010;
const isDev = process.env.NODE_ENV !== 'production';
const isProd = !isDev;
const secureCookies = process.env.COOKIE_SECURE === 'true'
  ? true
  : process.env.COOKIE_SECURE === 'false'
    ? false
    : !isDev;

function resolveAppUrl(envValue, fallback) {
  const url = typeof envValue === 'string' ? envValue.trim() : '';
  if (url) return url;
  return isProd ? '' : fallback;
}

if (!isDev) app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

if (isDev) {
  app.use(cors({ origin: 'http://localhost:5174', credentials: true }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name:              'hub.sid',
  secret:            process.env.SESSION_SECRET || 'hub-devsecret',
  store:             getSessionStore(),
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
app.use('/api/access-requests', accessRequestRouter);
app.get('/api/me', requireAuth, (req, res) => res.json(req.session.user));
app.use('/api/sso', ssoRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.get('/api/apps', requireAuth, (req, res) => res.json(
  APPS.filter(app => app.url && hasAppAccess(req.session.user, app.id))
));

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error('[HUB]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[HUB] MTSI Security Hub running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

const APPS = [
  {
    id: 'scorva', name: 'SCORVA', tagline: 'Cyber Command Center',
    desc: 'NIST SP 800-53 Rev 5 compliance management — ATO tracking, continuous monitoring, POAM, asset inventory, and access governance.',
    url: resolveAppUrl(process.env.SCORVA_URL, 'http://localhost:3000'), ssoPath: '/auth/sso', color: 'teal', icon: 'scorva-logo',
    team: 'Cybersecurity', status: 'live', tags: ['NIST 800-53', 'RMF', 'ATO', 'ConMon', 'POAM'],
  },
  {
    id: 'crater', name: 'CRATER', tagline: 'eMASS RMF Toolkit',
    desc: 'eMASS-aligned RMF package builder with SCTM, POAM management, vulnerability tracking, diagrams, and compliance reporting.',
    url: resolveAppUrl(process.env.CRATER_URL, 'http://localhost:3003'), ssoPath: '/sso.html', color: 'indigo', icon: 'FileText',
    team: 'GRC', status: 'live', tags: ['eMASS', 'RMF', 'SCTM', 'POAM', 'Vulnerabilities'],
  },
  {
    id: 'sentinel', name: 'Sentinel', tagline: 'Security Operations Center',
    desc: 'Comprehensive security management platform for facility compliance, personnel clearances, document control, and compliance tracking.',
    url: resolveAppUrl(process.env.SENTINEL_URL || process.env.MASH_URL, 'http://localhost:8080'), ssoPath: '/auth/sso', color: 'gold', icon: 'BarChart3',
    team: 'Security Operations', status: 'live', tags: ['Facility Security', 'Personnel Security', 'Document Control', 'Compliance'],
  },
  {
    id: 'lava', name: 'LAVA', tagline: 'Network Access Portal',
    desc: 'Magmatic onboarding portal with digitized DD Form 2875 SAAR workflow, Vulcan approval command, and hardware asset provisioning.',
    url: resolveAppUrl(process.env.LAVA_URL, 'http://localhost:3002'), ssoPath: '/auth/sso', color: 'orange', icon: 'Flame',
    team: 'Network Administration', status: 'live', tags: ['SAAR', 'DD Form 2875', 'Access Control', 'Hardware', 'YubiKey'],
  },
  {
    id: 'nexus', name: 'NEXUS', tagline: 'Program Mission Command',
    desc: 'Executive command surface for program management, non-IT security posture, and SCORVA-fed IT and cybersecurity rollups.',
    url: resolveAppUrl(process.env.NEXUS_URL, 'http://localhost:8090'), ssoPath: '/auth/sso', color: 'cyan', icon: 'Command',
    team: 'Program Management', status: 'live', tags: ['Real Estate', 'Construction', 'Accreditation', 'Budget', 'Cyber Rollup'],
  },
];
