'use strict';
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const fs      = require('fs');
const path    = require('path');
const jwt     = require('jsonwebtoken');
const { getTokenEpoch } = require('../packages/db/src/tokenEpochCache');
const { dbOk, getModel, readCollection, writeCollection } = require('./pg-store');
const {
  SITE_OWNED_COLLECTIONS,
  resolveTenantScope,
  applyScopeFilter,
  assertSiteAccess,
  resolveWriteSiteId,
  getUserSiteScope,
} = require('./lib/tenantScope');

const mashDb = require('./lib/mashDb');
const { RELATIONAL_DOMAINS } = mashDb;
const { db } = require('../packages/db/src');
const { getAllowedApps } = require('../packages/db/src/appAccess');

const PORT       = process.env.PORT || 8080;
const DATA_DIR   = path.join(__dirname, 'data');
const CLIENT_DIR = path.join(__dirname, 'client', 'dist');
const JWT_SECRET = process.env.JWT_SECRET || 'smw-dev-secret-change-in-prod';
const JWT_TTL    = '8h';
const HUB_URL    = process.env.HUB_URL || null;
const HUB_HOST   = process.env.HUB_HOST || '127.0.0.1';
const HUB_PORT   = parseInt(process.env.HUB_PORT || '3010', 10);

// Validate JWT_SECRET in production
if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('dev-secret'))) {
  console.error('FATAL: JWT_SECRET must be set to a strong secret (32+ chars) in production');
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Singletons and collections ────────────────────────────────────────────────
const SINGLETON = new Set([
  'security_workspace_settings', 'workspace_role_mappings',
  // legacy MASH singletons kept for backward compat
  'budget', 'timeline', 'compliance', 'settings', 'role_mappings',
]);

const WORKSPACE_COLLECTIONS = [
  'facility_security', 'personnel_security', 'activities_security',
  'document_control', 'dd254_register', 'media_control', 'self_inspection_ops', 'security_findings',
  'security_workspace_settings', 'workspace_role_mappings',
];

// ── Workspace roles ───────────────────────────────────────────────────────────
const WORKSPACE_ROLES = {
  corporate_security_admin: {
    display: 'Corporate Security Admin',
    nav: 'all',
    write: 'all',
  },
  facility_security_mgr: {
    display: 'Facility Security Manager',
    nav: ['overview', 'facility', 'activities', 'inspections'],
    write: ['facility_security', 'activities_security', 'self_inspection_ops', 'security_findings'],
  },
  personnel_security_mgr: {
    display: 'Personnel Security Manager',
    nav: ['overview', 'personnel', 'activities'],
    write: ['personnel_security', 'activities_security'],
  },
  activities_security_mgr: {
    display: 'Activities Security Manager',
    nav: ['overview', 'activities'],
    write: ['activities_security'],
  },
  document_control_mgr: {
    display: 'Document Control Manager',
    nav: ['overview', 'documents', 'dd254'],
    write: ['document_control', 'dd254_register'],
  },
  media_control_mgr: {
    display: 'Media Control Manager',
    nav: ['overview', 'media'],
    write: ['media_control'],
  },
  viewer: {
    display: 'Viewer',
    nav: 'all',
    write: [],
  },
};

// ── JSON helpers ──────────────────────────────────────────────────────────────
function readJson(name) {
  const fp = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

const uid = () => 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

function normalizeSiteList(...values) {
  const flat = values.flatMap(v => Array.isArray(v) ? v : [v]);
  return [...new Set(flat.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

// ── Seeding ───────────────────────────────────────────────────────────────────
async function seedCollection(name) {
  if (!dbOk()) return;
  try {
    const existing = await readCollection(name);
    const isEmpty = Array.isArray(existing) ? existing.length === 0 : !existing || Object.keys(existing).length === 0;
    if (!isEmpty) return;
    const seed = readJson(name);
    if (seed) {
      await writeCollection(name, seed);
      console.log(`[seed] ${name} seeded`);
    }
  } catch (err) {
    console.warn(`[seed] ${name} skipped:`, err.message);
  }
}

async function seedAll() {
  for (const col of WORKSPACE_COLLECTIONS) {
    await seedCollection(col);
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

async function auth(req, res, next) {
  let token = null;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.cookies?.mash_auth) {
    token = req.cookies.mash_auth;
  }
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });

    // Validate token epoch (revocation check)
    try {
      const currentEpoch = await getTokenEpoch(db, payload.id);
      const jwtEpoch = payload.tokenEpoch ?? 0;
      if (jwtEpoch < currentEpoch) {
        return res.status(401).json({ error: 'Token revoked' });
      }
    } catch (err) {
      console.error('[auth] epoch check error:', err.message);
    }

    // Normalize site fields: HUB issues lowercase (siteId/siteIds); handle any legacy variants
    const siteIds = normalizeSiteList(payload.siteIds, payload.siteIDs, payload.siteId, payload.siteID);
    const siteId  = payload.siteId || payload.siteID || siteIds[0] || null;
    req.user = {
      ...payload,
      siteId,
      siteIds,
      canSeeAllSites: Boolean(payload.canSeeAllSites) || payload.role === 'Corporate Admin' || payload.role === 'Hub Admin',
      securityRole:   payload.securityRole || null,
    };
    next();
  });
}

function hubUrl() {
  return HUB_URL || `http://${HUB_HOST}:${HUB_PORT}`;
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const resp = await fetch(`${hubUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data.error || 'Login failed' });

    const apps = Array.isArray(data.user?.allowedApps) ? data.user.allowedApps : [];
    if (!apps.includes('mash')) {
      return res.status(403).json({ error: 'MASH access has not been granted for this account' });
    }

    const wsRole = await resolveWorkspaceRole(username, data.user.securityRole);
    const payload = { ...data.user, tokenEpoch: data.user.tokenEpoch || 0, wsRole };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
    res.json({ token, user: payload });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(503).json({ error: 'Hub unreachable' });
  }
});

app.get('/auth/sso', async (req, res) => {
  const token = req.query.token || req.query.hub_token;
  if (!token) return res.redirect('/?error=no_token');
  try {
    const resp = await fetch(`${hubUrl()}/api/sso/verify?token=${encodeURIComponent(token)}`);
    const data = await resp.json();
    if (!resp.ok || !data.valid || !data.user) return res.redirect('/?error=invalid_sso');

    if (data.user.requestedApp && data.user.requestedApp !== 'mash') {
      return res.redirect('/?error=invalid_sso_target');
    }

    // Phase 2: Re-validate against the database
    const localUser = await db.user.findUnique({
      where: { username: String(data.user.username || '').toLowerCase().trim() },
    });
    if (!localUser || localUser.status !== 'Active') {
      return res.redirect('/?error=access_denied');
    }
    if (!getAllowedApps(localUser).includes('mash')) {
      return res.redirect('/?error=mash_access_denied');
    }

    const wsRole = await resolveWorkspaceRole(localUser.username, localUser.securityRole);
    // Build JWT from localUser (database record), not HUB payload
    const siteIds = Array.isArray(localUser.siteIds) ? localUser.siteIds : [];
    const primarySiteId = localUser.siteId || siteIds[0] || null;
    const payload = {
      authVersion: 3,
      id: localUser.id,
      username: localUser.username,
      name: localUser.name,
      email: localUser.email,
      role: localUser.role,
      hubRole: localUser.role,
      securityRole: localUser.securityRole,
      jobRole: localUser.securityRole,
      siteId: primarySiteId,
      siteIds,
      primarySiteId,
      canSeeAllSites: localUser.role === 'Corporate Admin' || localUser.role === 'Hub Admin',
      allowedApps: getAllowedApps(localUser),
      initials: localUser.name ? localUser.name.split(' ').map(n => n[0]).join('') : '',
      tokenEpoch: localUser.tokenEpoch || 0,
      wsRole,
      via: 'sso',
    };
    const wsToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
    res.cookie('mash_auth', wsToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
    });
    res.redirect('/');
  } catch (err) {
    console.error('[sso]', err.message);
    res.redirect('/?error=sso_failed');
  }
});

const SECURITY_ROLE_TO_WS_ROLE = {
  'Corporate Security Admin': 'corporate_security_admin',
  'Facility Security':        'facility_security_mgr',
  'Personnel Security':       'personnel_security_mgr',
  'Activities Security':      'activities_security_mgr',
  'Document Control':         'document_control_mgr',
  'DD254 / Contract Security':'document_control_mgr',
  'Media Control':            'media_control_mgr',
};

function mapSecurityRoleToWsRole(securityRole) {
  return SECURITY_ROLE_TO_WS_ROLE[securityRole] || 'viewer';
}

async function resolveWorkspaceRole(username, hubSecurityRole) {
  if (hubSecurityRole) return mapSecurityRoleToWsRole(hubSecurityRole);
  try {
    const mappings = await readCollectionSafe('workspace_role_mappings');
    if (mappings && mappings[username]) return mappings[username].role;
  } catch {}
  return 'viewer';
}

// ── Collection helpers ────────────────────────────────────────────────────────
async function readCollectionSafe(name) {
  if (dbOk()) {
    try { return await readCollection(name); } catch {}
  }
  return readJson(name) || (SINGLETON.has(name) ? {} : []);
}

async function writeCollectionSafe(name, data) {
  if (dbOk()) {
    try { return await writeCollection(name, data); } catch {}
  }
}

function siteFilter(items, siteId) {
  if (!siteId || !Array.isArray(items)) return items;
  return items.filter(i => i.siteId === siteId);
}

// ── Overview aggregate ────────────────────────────────────────────────────────
app.get('/api/workspace/overview', auth, async (req, res) => {
  try {
    const scope = resolveTenantScope(req);
    let fac, per, act, doc, dd254s, med, fin, ins;

    if (dbOk()) {
      ({ facilities: fac, personnel: per, activities: act, docs: doc,
         dd254s, media: med, findings: fin, inspections: ins } = await mashDb.aggregateOverview(scope));
    } else {
      // JSON fallback (no-DB dev mode)
      const { canSeeAllSites, siteIds } = getUserSiteScope(req.user);
      const requestedSiteId = req.query.siteId || null;
      const sid = requestedSiteId || (!canSeeAllSites ? (siteIds[0] || null) : null);
      const [f, p, a, d, dd, m, fi, i] = await Promise.all([
        readCollectionSafe('facility_security'),
        readCollectionSafe('personnel_security'),
        readCollectionSafe('activities_security'),
        readCollectionSafe('document_control'),
        readCollectionSafe('dd254_register'),
        readCollectionSafe('media_control'),
        readCollectionSafe('security_findings'),
        readCollectionSafe('self_inspection_ops'),
      ]);
      fac = siteFilter(f, sid); per = siteFilter(p, sid); act = siteFilter(a, sid);
      doc = siteFilter(d, sid); dd254s = siteFilter(dd, sid); med = siteFilter(m, sid); fin = siteFilter(fi, sid);
      ins = siteFilter(i, sid);
    }

    const today = new Date();
    const warnDate = new Date(today); warnDate.setDate(today.getDate() + 30);
    const prd180 = new Date(today); prd180.setDate(today.getDate() + 180);

    const overdueTraining = per.filter(p =>
      Object.values(p.training || {}).some(t => t && t.status === 'Overdue')
    );
    const dueSoonTraining = per.filter(p =>
      Object.values(p.training || {}).some(t => t && t.status === 'Due Soon')
    );
    const clearanceExpiring = per.filter(p => {
      if (!p.clearancePRD) return false;
      const prd = new Date(p.clearancePRD);
      return prd <= prd180 && prd >= today;
    });
    const debriefPending = per.filter(p =>
      (p.foreignTravel || []).some(t => !t.debriefed)
    );

    const openFindings = fin.filter(f => f.status !== 'Closed');
    const highFindings = openFindings.filter(f => f.severity === 'High');

    const overdueMedia = med.filter(m => m.status === 'Overdue Return' || (m.flags || []).length > 0);
    const pendingDestruction = med.filter(m => m.status === 'Pending Destruction');
    const dd254Expiring = (dd254s || []).filter(item => {
      if (!item.expirationDate) return false;
      const dt = new Date(item.expirationDate);
      return dt <= warnDate;
    });
    const dd254ReviewDue = (dd254s || []).filter(item => {
      if (!item.reviewDueDate) return false;
      const dt = new Date(item.reviewDueDate);
      return dt <= warnDate;
    });
    const dd254Actionable = (dd254s || []).filter(item =>
      ['draft', 'pending review', 'revision required', 'expired'].includes(String(item.dd254Status || '').toLowerCase())
    );

    const overdueActivities = act.filter(a => a.status === 'Overdue');
    const upcomingActivities = act.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date);
      return d >= today && d <= warnDate;
    });

    const idsIssues = fac.filter(f =>
      f.alarmIDS && f.alarmIDS.status !== 'Operational'
    );

    const upcomingInspections = ins.filter(i => {
      if (i.status === 'Completed') return false;
      const due = new Date(i.dueDate);
      return due >= today && due <= new Date(today.getTime() + 90 * 86400000);
    });

    res.json({
      summary: {
        facilities: fac.length,
        personnel: per.length,
        openFindings: openFindings.length,
        highFindings: highFindings.length,
      },
      alerts: {
        overdueTraining: overdueTraining.map(p => ({ id: p.id, name: p.name, siteId: p.siteId })),
        dueSoonTraining: dueSoonTraining.length,
        clearanceExpiring: clearanceExpiring.map(p => ({ id: p.id, name: p.name, prd: p.clearancePRD })),
        debriefPending: debriefPending.map(p => ({ id: p.id, name: p.name })),
        overdueMedia: overdueMedia.map(m => ({ id: m.id, mediaId: m.mediaId, assignedTo: m.assignedTo })),
        pendingDestruction: pendingDestruction.length,
        idsIssues: idsIssues.map(f => ({ id: f.id, name: f.name, issue: f.alarmIDS.notes || f.alarmIDS.status })),
        overdueActivities: overdueActivities.map(a => ({ id: a.id, title: a.title, siteId: a.siteId })),
      },
      upcoming: {
        activities: upcomingActivities.slice(0, 5),
        inspections: upcomingInspections.slice(0, 3),
      },
      activities: {
        total: act.length,
        scheduled: act.filter(a => ['Planned', 'Scheduled'].includes(a.status)).length,
        openIssues: act.filter(a => !['Completed', 'Cancelled'].includes(a.status)).length,
      },
      documents: {
        total: doc.length,
        accountable: doc.filter(d => d.accountable).length,
        pendingInventory: doc.filter(d => {
          if (!d.nextInventory) return false;
          return new Date(d.nextInventory) <= warnDate;
        }).length,
        dd254Total: (dd254s || []).length,
        dd254Expiring: dd254Expiring.length,
        dd254ReviewDue: dd254ReviewDue.length,
        dd254Actionable: dd254Actionable.length,
      },
      media: {
        total: med.length,
        assigned: med.filter(m => m.status === 'Assigned').length,
        overdueReturn: overdueMedia.length,
        pendingDestruction: pendingDestruction.length,
      },
      findings: {
        open: openFindings.length,
        high: highFindings.length,
        bySeverity: {
          High: fin.filter(f => f.severity === 'High' && f.status !== 'Closed').length,
          Medium: fin.filter(f => f.severity === 'Medium' && f.status !== 'Closed').length,
          Low: fin.filter(f => f.severity === 'Low' && f.status !== 'Closed').length,
        },
      },
    });
  } catch (err) {
    const status = err.status || 500;
    console.error('[overview]', { user: req.user?.username, siteIds: req.user?.siteIds, status, message: err.message });
    res.status(status).json({ error: err.message || 'Overview aggregation failed' });
  }
});

// ── Workspace settings ────────────────────────────────────────────────────────
app.get('/api/workspace/settings', auth, async (req, res) => {
  const data = await readCollectionSafe('security_workspace_settings');
  res.json(data || {});
});

// ── Role mappings ─────────────────────────────────────────────────────────────
app.get('/api/workspace/role-mappings', auth, async (req, res) => {
  const data = await readCollectionSafe('workspace_role_mappings');
  res.json({ mappings: data || {}, roles: WORKSPACE_ROLES });
});

app.put('/api/workspace/role-mappings/:username', auth, async (req, res) => {
  const { username } = req.params;
  const { role, displayTitle, siteIds } = req.body || {};
  if (!WORKSPACE_ROLES[role]) return res.status(400).json({ error: 'Unknown role' });
  const mappings = await readCollectionSafe('workspace_role_mappings') || {};
  mappings[username] = { role, displayTitle: displayTitle || WORKSPACE_ROLES[role].display, siteIds: siteIds || [] };
  await writeCollectionSafe('workspace_role_mappings', mappings);
  res.json({ ok: true, mappings });
});

// ── Generic workspace collection CRUD ─────────────────────────────────────────
function isValidWorkspaceCollection(name) {
  return WORKSPACE_COLLECTIONS.includes(name) || /^[a-z][a-z0-9_]{0,62}$/.test(name);
}

app.get('/api/ws/:collection', auth, async (req, res) => {
  const { collection } = req.params;
  if (!isValidWorkspaceCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
  try {
    if (RELATIONAL_DOMAINS.has(collection)) {
      const scope = resolveTenantScope(req);
      return res.json(await mashDb.findMany(collection, scope));
    }
    let data = await readCollectionSafe(collection);
    if (SITE_OWNED_COLLECTIONS.has(collection) && Array.isArray(data)) {
      const scope = resolveTenantScope(req);
      data = applyScopeFilter(data, scope);
    }
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  }
});

app.post('/api/ws/:collection', auth, async (req, res) => {
  const { collection } = req.params;
  if (!isValidWorkspaceCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
  if (SINGLETON.has(collection)) return res.status(400).json({ error: 'Use PUT for singletons' });
  try {
    if (RELATIONAL_DOMAINS.has(collection)) {
      const siteId = resolveWriteSiteId(req);
      const record = await mashDb.create(collection, {
        id: uid(), ...req.body, siteId,
        createdBy: req.user.username, updatedBy: req.user.username,
      });
      return res.status(201).json(record);
    }
    if (SITE_OWNED_COLLECTIONS.has(collection)) {
      req.body.siteId = resolveWriteSiteId(req);
    }
    const item = { id: uid(), createdAt: new Date().toISOString(), createdBy: req.user.username, ...req.body };
    const data = await readCollectionSafe(collection) || [];
    data.push(item);
    await writeCollectionSafe(collection, data);
    res.status(201).json(item);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  }
});

app.put('/api/ws/:collection', auth, async (req, res) => {
  const { collection } = req.params;
  if (!isValidWorkspaceCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
  if (RELATIONAL_DOMAINS.has(collection)) return res.status(405).json({ error: 'Use POST/PATCH for relational domains' });
  await writeCollectionSafe(collection, req.body);
  res.json({ ok: true });
});

app.patch('/api/ws/:collection/:id', auth, async (req, res) => {
  const { collection, id } = req.params;
  if (!isValidWorkspaceCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
  try {
    if (RELATIONAL_DOMAINS.has(collection)) {
      const doc = await mashDb.findById(collection, id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      if (!assertSiteAccess(req.user, doc.siteId)) return res.status(403).json({ error: 'Site access denied' });
      const updated = await mashDb.update(collection, id, { ...req.body, updatedBy: req.user.username });
      return res.json(updated);
    }
    const data = await readCollectionSafe(collection) || [];
    const idx = data.findIndex(i => i.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    if (SITE_OWNED_COLLECTIONS.has(collection)) {
      if (!assertSiteAccess(req.user, data[idx].siteId)) {
        return res.status(403).json({ error: 'Site access denied' });
      }
    }
    data[idx] = { ...data[idx], ...req.body, id, updatedAt: new Date().toISOString(), updatedBy: req.user.username };
    await writeCollectionSafe(collection, data);
    res.json(data[idx]);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  }
});

app.delete('/api/ws/:collection/:id', auth, async (req, res) => {
  const { collection, id } = req.params;
  if (!isValidWorkspaceCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
  try {
    if (RELATIONAL_DOMAINS.has(collection)) {
      const doc = await mashDb.findById(collection, id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      if (!assertSiteAccess(req.user, doc.siteId)) return res.status(403).json({ error: 'Site access denied' });
      await mashDb.remove(collection, id);
      return res.json({ ok: true });
    }
    let data = await readCollectionSafe(collection) || [];
    const target = data.find(i => i.id === id);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (SITE_OWNED_COLLECTIONS.has(collection)) {
      if (!assertSiteAccess(req.user, target.siteId)) {
        return res.status(403).json({ error: 'Site access denied' });
      }
    }
    data = data.filter(i => i.id !== id);
    await writeCollectionSafe(collection, data);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  }
});

// ── Legacy MASH generic CRUD (backward compat) ────────────────────────────────
function validLegacyCollection(name) {
  const reserved = ['users', 'workspace_role_mappings'];
  return /^[a-z0-9_-]{1,64}$/i.test(name) && !reserved.includes(name);
}

app.get('/api/:collection', auth, async (req, res) => {
  const { collection } = req.params;
  if (!validLegacyCollection(collection)) return res.status(400).json({ error: 'Invalid collection' });
  const data = await readCollectionSafe(collection);
  res.json(data ?? (SINGLETON.has(collection) ? {} : []));
});

app.post('/api/:collection', auth, async (req, res) => {
  const { collection } = req.params;
  if (!validLegacyCollection(collection) || SINGLETON.has(collection)) return res.status(400).json({ error: 'Invalid' });
  const item = { id: uid(), ...req.body };
  const data = await readCollectionSafe(collection) || [];
  data.push(item);
  await writeCollectionSafe(collection, data);
  res.status(201).json(item);
});

app.put('/api/:collection', auth, async (req, res) => {
  const { collection } = req.params;
  if (!validLegacyCollection(collection)) return res.status(400).json({ error: 'Invalid' });
  await writeCollectionSafe(collection, req.body);
  res.json({ ok: true });
});

app.patch('/api/:collection/:id', auth, async (req, res) => {
  const { collection, id } = req.params;
  if (!validLegacyCollection(collection)) return res.status(400).json({ error: 'Invalid' });
  const data = await readCollectionSafe(collection) || [];
  const idx = data.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body, id };
  await writeCollectionSafe(collection, data);
  res.json(data[idx]);
});

app.delete('/api/:collection/:id', auth, async (req, res) => {
  const { collection, id } = req.params;
  if (!validLegacyCollection(collection)) return res.status(400).json({ error: 'Invalid' });
  let data = await readCollectionSafe(collection) || [];
  data = data.filter(i => i.id !== id);
  await writeCollectionSafe(collection, data);
  res.json({ ok: true });
});

// ── Static SPA ────────────────────────────────────────────────────────────────
if (fs.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
      res.sendFile(path.join(CLIENT_DIR, 'index.html'));
    }
  });
} else {
  app.get('/', (req, res) => res.send('Security Managers Workspace — client not built'));
}

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Security Managers Workspace — port ${PORT}`);
  console.log(`DB: ${dbOk() ? 'PostgreSQL' : 'JSON fallback'}`);
  await seedAll();
});
