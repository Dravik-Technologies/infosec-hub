'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { db } = require('../packages/db/src');
const { readCollection, writeCollection } = require('./pg-store');
const { getAllowedApps, getScorvaRole } = require('../packages/db/src/appAccess');

const PORT = process.env.PORT || 8090;
const DATA_DIR = path.join(__dirname, 'data');
const JWT_SECRET = process.env.JWT_SECRET || 'nexus-dev-secret-change-in-prod';
const JWT_TTL = '8h';
const HUB_URL = process.env.HUB_URL || null;
const HUB_HOST = process.env.HUB_HOST || '127.0.0.1';
const HUB_PORT = parseInt(process.env.HUB_PORT || '3010', 10);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const COLLECTIONS = ['program_management', 'program_security', 'nexus_settings'];
const PM_ARRAY_SECTIONS = new Set(['realEstate', 'construction', 'accreditations', 'milestones']);
const DEFAULT_PERMISSIONS = {
  adminHubRoles: ['Hub Admin'],
  adminJobRoles: ['Program Manager'],
  adminUsers: [],
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function readJson(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function parseJsonField(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return null;
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function mergePermissions(settings) {
  const configured = settings && typeof settings === 'object' ? settings.permissions || {} : {};
  return {
    adminHubRoles: asStringArray(configured.adminHubRoles).length
      ? asStringArray(configured.adminHubRoles)
      : DEFAULT_PERMISSIONS.adminHubRoles,
    adminJobRoles: asStringArray(configured.adminJobRoles).length
      ? asStringArray(configured.adminJobRoles)
      : DEFAULT_PERMISSIONS.adminJobRoles,
    adminUsers: asStringArray(configured.adminUsers),
  };
}

function isNexusAdminUser(user, permissions) {
  if (!user) return false;
  const hubRole = user.hubRole || user.role || '';
  const jobRole = user.jobRole || user.securityRole || '';
  const username = String(user.username || '').toLowerCase();
  const adminUsers = (permissions.adminUsers || []).map(v => String(v).toLowerCase());
  return adminUsers.includes(username)
    || (permissions.adminHubRoles || []).includes(hubRole)
    || (permissions.adminJobRoles || []).includes(jobRole);
}

async function seedDefaults() {
  for (const name of COLLECTIONS) {
    const existing = await readCollection(name);
    if (existing != null) continue;
    const seed = readJson(name);
    if (seed != null) {
      await writeCollection(name, seed);
      console.log(`[NEXUS] Seeded ${name}`);
    }
  }
}

function buildHubUrl(pathname) {
  const baseUrl = HUB_URL || `http://${HUB_HOST}:${HUB_PORT}`;
  return new URL(pathname, baseUrl);
}

function proxyLoginToHub(username, password) {
  const loginUrl = buildHubUrl('/auth/login');
  return fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(async res => {
    let parsed;
    try { parsed = await res.json(); } catch { throw new Error('Bad response from hub'); }
    if (res.ok && parsed.user) return parsed.user;
    throw new Error(parsed.error || 'Invalid credentials');
  });
}

function verifyHubToken(token) {
  const verifyUrl = buildHubUrl('/api/sso/verify');
  verifyUrl.searchParams.set('token', token);
  return fetch(verifyUrl).then(async res => {
    let parsed;
    try { parsed = await res.json(); } catch { throw new Error('Bad response from hub'); }
    if (res.ok && parsed.valid) return parsed.user;
    throw new Error(parsed.error || 'SSO verification failed');
  });
}

function mapHubUser(hubUser, settings) {
  const primarySiteId = hubUser.primarySiteId || hubUser.siteId || hubUser.site || null;
  const siteIds = Array.isArray(hubUser.siteIds) ? hubUser.siteIds.filter(Boolean) : [];
  if (primarySiteId && !siteIds.includes(primarySiteId)) siteIds.unshift(primarySiteId);
  const hubRole = hubUser.hubRole || hubUser.role || 'Hub Viewer';
  const jobRole = hubUser.jobRole || hubUser.securityRole || null;
  const isCorporateAdmin = ['Corporate Admin', 'Hub Admin'].includes(hubRole);
  const resolvedPrimarySiteId = primarySiteId || siteIds[0] || null;
  const permissions = mergePermissions(settings);
  return {
    sub: hubUser.id || hubUser._id || hubUser.username,
    username: hubUser.username,
    name: hubUser.name || hubUser.username,
    title: hubUser.title || 'Program Stakeholder',
    hubRole,
    jobRole,
    primarySiteId: resolvedPrimarySiteId,
    siteIds,
    allowedApps: getAllowedApps(hubUser),
    nexusAdmin: isNexusAdminUser({
      ...hubUser,
      hubRole,
      jobRole,
      primarySiteId: resolvedPrimarySiteId,
      siteIds,
    }, permissions),
    authVersion: 3,

    // Legacy compatibility aliases during transition.
    role: hubRole,
    siteId: resolvedPrimarySiteId,
    canSeeAllSites: Boolean(hubUser.canSeeAllSites) || isCorporateAdmin,
    securityRole: jobRole,
    scorvaRole: getScorvaRole(hubUser) || null,
  };
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

async function requireAdminRole(req, res, next) {
  if (req.user?.nexusAdmin) return next();
  try {
    const settings = await readSharedCollection('nexus_settings');
    if (isNexusAdminUser(req.user, mergePermissions(settings))) return next();
  } catch {}
  return res.status(403).json({ error: 'NEXUS admin access required' });
}

async function readSharedCollection(name) {
  const data = await readCollection(name);
  return data != null ? data : {};
}

// ── MASH-backed Program Security rollup ───────────────────────────────────────

async function buildSecurityRollup(viewer) {
  const canSeeAll = !viewer || viewer.role === 'Corporate Admin' || viewer.role === 'Hub Admin' || Boolean(viewer.canSeeAllSites);
  const siteFilter = (!canSeeAll && Array.isArray(viewer?.siteIds) && viewer.siteIds.length)
    ? { siteId: { in: viewer.siteIds } }
    : {};

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const in30Str = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [facilities, personnel, activities, findings] = await Promise.all([
    db.mashFacilitySecurity.findMany({ where: siteFilter }),
    db.mashPersonnelSecurity.findMany({ where: siteFilter }),
    db.mashActivitiesSecurity.findMany({ where: siteFilter }),
    db.mashSecurityFinding.findMany({ where: siteFilter }),
  ]);

  // Facility posture categorization
  const facilityCounts = { nominal: 0, guarded: 0, elevated: 0 };
  const facilityList = facilities.map(f => {
    const s = (f.status || '').toLowerCase();
    const posture = /elevated|critical|risk/.test(s) ? 'elevated'
      : /guarded|watch|limited/.test(s) ? 'guarded'
      : 'nominal';
    facilityCounts[posture]++;
    const openIssues = parseJsonField(f.openIssues) || [];
    const inspection = parseJsonField(f.dcsaInspection) || {};
    return {
      id: f.id,
      site: f.name,
      siteId: f.siteId,
      status: posture.charAt(0).toUpperCase() + posture.slice(1),
      issue: openIssues.length > 0
        ? `${openIssues.length} open issue${openIssues.length !== 1 ? 's' : ''}`
        : null,
      complianceScore: f.complianceScore ?? null,
      lastReview: inspection.lastDate || inspection.date || null,
    };
  });

  // Personnel training — training is a JSON blob; check common field variants
  function getTrainingDue(p) {
    const t = parseJsonField(p.training) || {};
    return t.trainingDue || t.annualReviewDue || t.dueDate || t.annualBriefingDue || null;
  }

  const trainingOverdue = personnel.filter(p => {
    const due = getTrainingDue(p);
    return due && due < todayStr;
  }).length;
  const trainingDueSoon = personnel.filter(p => {
    const due = getTrainingDue(p);
    return due && due >= todayStr && due <= in30Str;
  }).length;
  const trainingCurrent = personnel.filter(p => {
    const due = getTrainingDue(p);
    return !due || due > in30Str;
  }).length;

  // Visit access requests
  const allVisits = personnel.flatMap(p => parseJsonField(p.visitAccessRequests) || []);
  const openVisits = allVisits.filter(r => {
    const s = (r.status || '').toLowerCase();
    return !['approved', 'denied', 'closed', 'completed'].includes(s);
  }).length;
  const priorityVisits = allVisits.filter(r =>
    (r.priority || '').toLowerCase() === 'priority'
  ).length;

  // Clearance breakdown
  const clearanceBreakdown = {};
  let activeClearances = 0;
  let pendingClearances = 0;
  let reinvestigationsDue = 0;
  personnel.forEach(p => {
    const cs = (p.clearanceStatus || '').toLowerCase();
    if (cs === 'active') activeClearances++;
    if (['pending', 'in progress', 'submitted'].includes(cs)) pendingClearances++;
    if (p.clearancePRD && p.clearancePRD >= todayStr && p.clearancePRD <= in30Str) reinvestigationsDue++;
    if (p.clearanceLevel) {
      clearanceBreakdown[p.clearanceLevel] = (clearanceBreakdown[p.clearanceLevel] || 0) + 1;
    }
  });

  // Activities categories
  const catMap = {};
  activities.forEach(a => {
    const cat = a.category || 'General';
    if (!catMap[cat]) catMap[cat] = { name: cat, open: 0, total: 0 };
    catMap[cat].total++;
    if (!['Completed', 'Cancelled'].includes(a.status || '')) catMap[cat].open++;
  });
  const categoryList = Object.entries(catMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.open - a.open)
    .slice(0, 6);

  const openFindings = findings.filter(f => (f.status || '').toLowerCase() !== 'closed');
  const totalActivities = activities.length;
  const openActivities = activities.filter(a => !['Completed', 'Cancelled'].includes(a.status || '')).length;

  return {
    generatedAt: new Date().toISOString(),
    _source: 'live',
    facilitySecurity: {
      summary: facilityCounts,
      sites: facilityList,
      openFindingsCount: openFindings.length,
      highFindingsCount: openFindings.filter(f => (f.severity || '').toLowerCase() === 'high').length,
    },
    personnelSecurity: {
      training: { current: trainingCurrent, overdue: trainingOverdue, dueSoon: trainingDueSoon },
      visitAccessRequests: { open: openVisits, priority: priorityVisits, processedThisWeek: 0 },
      clearanceStatus: { active: activeClearances, pendingAdjudication: pendingClearances, reinvestigationsDue, ...clearanceBreakdown },
    },
    activitiesSecurity: {
      headline: totalActivities > 0
        ? `${openActivities} open across ${Object.keys(catMap).length} categor${Object.keys(catMap).length === 1 ? 'y' : 'ies'} — ${totalActivities} total tracked.`
        : null,
      categories: categoryList,
      openCount: openActivities,
    },
  };
}

// ── SCORVA-backed IT/Cybersecurity rollup ──────────────────────────────────────

async function buildCyberRollup(viewer) {
  const canSeeAll = !viewer || viewer.role === 'Corporate Admin' || viewer.role === 'Hub Admin' || Boolean(viewer.canSeeAllSites);
  const siteFilter = (!canSeeAll && Array.isArray(viewer?.siteIds) && viewer.siteIds.length)
    ? { siteId: { in: viewer.siteIds } }
    : {};

  const now = new Date();
  const soonWindow = new Date(now);
  soonWindow.setDate(soonWindow.getDate() + 30);

  const [atos, poams, users, workstations, saars, systemRequests, assets, securityEvents] = await Promise.all([
    db.atoPackage.findMany({ where: siteFilter, orderBy: { system: 'asc' } }),
    db.poam.findMany({ where: siteFilter, orderBy: { updatedAt: 'desc' } }),
    db.user.findMany({ where: siteFilter, orderBy: { name: 'asc' } }),
    db.workstation.findMany({ where: siteFilter }),
    db.lavaSaar.findMany({
      where: siteFilter,
      select: {
        id: true,
        status: true,
        siteId: true,
      },
    }),
    db.lavaSystemRequest.findMany({ where: siteFilter }),
    db.lavaAsset.findMany({ where: siteFilter }),
    db.securityEvent.findMany({ where: siteFilter, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);

  const openPoams = poams.filter(item => !['closed', 'complete', 'completed', 'resolved'].includes(String(item.status || '').toLowerCase()));
  const pendingSaars = saars.filter(item => String(item.status || '').toLowerCase() === 'pending').length;
  const activeUsers = users.filter(item => String(item.status || '').toLowerCase() === 'active');
  const disabledUsers = users.filter(item => String(item.status || '').toLowerCase() === 'disabled').length;

  const overdueTraining = activeUsers.filter(item => {
    if (!item.trainingDue) return false;
    return new Date(`${item.trainingDue}T12:00:00Z`) < now;
  }).length;
  const dueSoonTraining = activeUsers.filter(item => {
    if (!item.trainingDue) return false;
    const due = new Date(`${item.trainingDue}T12:00:00Z`);
    return due >= now && due <= soonWindow;
  }).length;

  const poamSeverity = openPoams.reduce((acc, item) => {
    const key = (item.severity || 'Unknown').toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const atoStatus = atos.reduce((acc, item) => {
    const key = item.status || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const expiringAtos = atos.filter(item => {
    if (!item.expires) return false;
    const expiry = new Date(`${item.expires}T12:00:00Z`);
    return expiry >= now && expiry <= soonWindow;
  }).length;

  const hardwareInstalled = workstations.filter(item =>
    ['issued', 'operational', 'active', 'assigned', 'available'].includes(String(item.status || '').toLowerCase())
  ).length;
  const hardwareProgress = workstations.length ? Math.round((hardwareInstalled / workstations.length) * 100) : 0;
  const softwareFulfillment = systemRequests.length
    ? Math.round((systemRequests.filter(item =>
        ['approved', 'fulfilled', 'active'].includes(String(item.status || '').toLowerCase())
      ).length / systemRequests.length) * 100)
    : 0;

  // Security events summary
  const openEvents = securityEvents.filter(e =>
    !['closed', 'resolved', 'dismissed'].includes((e.status || '').toLowerCase())
  );
  const eventsBySeverity = securityEvents.reduce((acc, e) => {
    const key = e.severity || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    ato: {
      total: atos.length,
      expiringSoon: expiringAtos,
      byStatus: atoStatus,
      systems: atos.slice(0, 6).map(item => ({
        id: item.id,
        system: item.system,
        status: item.status,
        expires: item.expires,
        siteId: item.siteId,
      })),
    },
    poams: {
      open: openPoams.length,
      bySeverity: poamSeverity,
      items: openPoams.slice(0, 6).map(item => ({
        id: item.id,
        title: item.title,
        severity: item.severity,
        status: item.status,
        siteId: item.siteId,
        dueDate: item.scheduledCompletion,
      })),
    },
    users: {
      active: activeUsers.length,
      disabled: disabledUsers,
      pendingRequests: pendingSaars,
      overdueTraining,
      dueSoonTraining,
    },
    delivery: {
      hardwareInstalled,
      totalHardware: workstations.length,
      hardwareProgress,
      systemRequestsPending: systemRequests.filter(item =>
        ['pending', 'in_review'].includes(String(item.status || '').toLowerCase())
      ).length,
      softwareFulfillment,
      provisionedAssets: assets.filter(item =>
        ['assigned', 'installed', 'operational', 'active'].includes(String(item.status || '').toLowerCase())
      ).length,
    },
    securityEvents: {
      total: securityEvents.length,
      open: openEvents.length,
      criticalHigh: openEvents.filter(e => ['critical', 'high'].includes((e.severity || '').toLowerCase())).length,
      bySeverity: eventsBySeverity,
      recent: securityEvents.slice(0, 5).map(e => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        status: e.status,
        siteId: e.siteId,
        createdAt: e.createdAt,
      })),
    },
  };
}

// ── Express app ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// ── Auth ───────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const hubUser = await proxyLoginToHub(username, password);
    const apps = Array.isArray(hubUser.allowedApps) ? hubUser.allowedApps : [];
    if (!apps.includes('nexus')) {
      return res.status(403).json({ error: 'NEXUS access has not been granted for this account' });
    }
    const settings = await readSharedCollection('nexus_settings');
    const payload = mapHubUser(hubUser, settings);
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
    res.json({ token, user: payload });
  } catch (err) {
    if (err.message === 'Invalid credentials') return res.status(401).json({ error: 'Invalid credentials' });
    res.status(503).json({ error: err.message });
  }
});

app.get('/auth/sso', async (req, res) => {
  const { hub_token } = req.query;
  if (!hub_token) return res.redirect('/?sso_error=missing_token');
  try {
    const hubUser = await verifyHubToken(hub_token);
    if (hubUser.requestedApp && hubUser.requestedApp !== 'nexus') {
      return res.redirect('/?sso_error=invalid_target');
    }
    const apps = Array.isArray(hubUser.allowedApps) ? hubUser.allowedApps : [];
    if (!apps.includes('nexus')) {
      return res.redirect('/?sso_error=nexus_access_denied');
    }
    const settings = await readSharedCollection('nexus_settings');
    const payload = { ...mapHubUser(hubUser, settings), via: 'sso' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
    res.redirect(`/?nexus_token=${token}`);
  } catch (err) {
    console.error('[NEXUS SSO]', err.message);
    res.redirect(`/?sso_error=${encodeURIComponent(err.message)}`);
  }
});

app.use('/api', requireAuth);

// ── Read routes ────────────────────────────────────────────────────────────────

// Bootstrap — single call that delivers all page data.
// Data sources:
//   programManagement  → editable (pg-store: admin-managed)
//   programSecurity    → derived (live MASH rollup, falls back to pg-store)
//   cyber              → derived (live SCORVA rollup)
//   settings           → editable (pg-store: admin-managed)
app.get('/api/bootstrap', async (req, res) => {
  try {
    const [settings, programManagement, cyberResult] = await Promise.all([
      readSharedCollection('nexus_settings'),
      readSharedCollection('program_management'),
      buildCyberRollup(req.user).catch(err => {
        console.error('[NEXUS cyber-rollup]', { user: req.user?.username, message: err.message });
        return { _error: err.message, _source: 'error' };
      }),
    ]);

    let programSecurity;
    let securitySource;
    try {
      programSecurity = await buildSecurityRollup(req.user);
      securitySource = 'live';
    } catch (err) {
      console.warn('[NEXUS security-rollup] Live rollup failed, using stored fallback:', err.message);
      const stored = await readSharedCollection('program_security').catch(() => null);
      programSecurity = stored || { _source: 'unavailable', _error: 'MASH data unavailable' };
      securitySource = stored && Object.keys(stored).length > 0 ? 'stored' : 'unavailable';
    }

    res.json({
      settings,
      programManagement,
      programSecurity,
      cyber: cyberResult,
      _sources: {
        programManagement: 'stored',
        programSecurity: securitySource,
        cyber: cyberResult?._error ? 'error' : 'live',
      },
    });
  } catch (err) {
    console.error('[NEXUS bootstrap]', err.message);
    res.status(500).json({ error: 'Unable to load NEXUS data' });
  }
});

app.get('/api/program-management', async (_req, res) => {
  try { res.json(await readSharedCollection('program_management')); }
  catch { res.status(500).json({ error: 'Unable to load program management data' }); }
});

app.get('/api/security-rollup', async (req, res) => {
  try { res.json(await buildSecurityRollup(req.user)); }
  catch (err) {
    const status = err.status || 500;
    console.error('[NEXUS security-rollup]', { user: req.user?.username, message: err.message });
    res.status(status).json({ error: err.message || 'Security rollup failed' });
  }
});

app.get('/api/cyber-rollup', async (req, res) => {
  try { res.json(await buildCyberRollup(req.user)); }
  catch (err) {
    const status = err.status || 500;
    console.error('[NEXUS cyber-rollup]', { user: req.user?.username, message: err.message });
    res.status(status).json({ error: err.message || 'Cyber rollup failed' });
  }
});

// ── Admin write routes (NEXUS-local admin permission) ─────────────────────────

// PUT /api/program-management — replace full PM collection
app.put('/api/program-management', requireAdminRole, async (req, res) => {
  try {
    await writeCollection('program_management', req.body || {});
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to save program management data' });
  }
});

// PUT /api/admin/pm/portfolio — update portfolio metadata (fiscalYear, budget totals, name)
app.put('/api/admin/pm/portfolio', requireAdminRole, async (req, res) => {
  try {
    const existing = await readSharedCollection('program_management');
    const updated = { ...existing, portfolio: { ...(existing.portfolio || {}), ...req.body } };
    await writeCollection('program_management', updated);
    res.json(updated.portfolio);
  } catch {
    res.status(500).json({ error: 'Unable to update portfolio' });
  }
});

// POST /api/admin/pm/kpis/:id — upsert a single KPI by id
app.put('/api/admin/pm/kpis/:id', requireAdminRole, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await readSharedCollection('program_management');
    const kpis = Array.isArray(existing.portfolio?.kpis) ? existing.portfolio.kpis : [];
    const idx = kpis.findIndex(k => k.id === id);
    const item = idx >= 0 ? { ...kpis[idx], ...req.body, id } : { ...req.body, id };
    const newKpis = idx >= 0 ? [...kpis.slice(0, idx), item, ...kpis.slice(idx + 1)] : [...kpis, item];
    const updated = { ...existing, portfolio: { ...(existing.portfolio || {}), kpis: newKpis } };
    await writeCollection('program_management', updated);
    res.json(item);
  } catch {
    res.status(500).json({ error: 'Unable to update KPI' });
  }
});

// DELETE /api/admin/pm/kpis/:id — remove a KPI card from portfolio.kpis
app.delete('/api/admin/pm/kpis/:id', requireAdminRole, async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await readSharedCollection('program_management');
    const kpis = Array.isArray(existing.portfolio?.kpis) ? existing.portfolio.kpis : [];
    const newKpis = kpis.filter(k => k.id !== id);
    if (newKpis.length === kpis.length) return res.status(404).json({ error: 'KPI not found' });
    const updated = { ...existing, portfolio: { ...(existing.portfolio || {}), kpis: newKpis } };
    await writeCollection('program_management', updated);
    res.json({ deleted: id });
  } catch {
    res.status(500).json({ error: 'Unable to delete KPI' });
  }
});

// POST /api/admin/pm/:section — add item to array section
app.post('/api/admin/pm/:section', requireAdminRole, async (req, res) => {
  const { section } = req.params;
  if (!PM_ARRAY_SECTIONS.has(section)) return res.status(400).json({ error: 'Invalid section' });
  try {
    const existing = await readSharedCollection('program_management');
    const arr = Array.isArray(existing[section]) ? existing[section] : [];
    const item = { ...req.body, id: req.body.id || uid() };
    await writeCollection('program_management', { ...existing, [section]: [...arr, item] });
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: `Unable to add ${section} item` });
  }
});

// PUT /api/admin/pm/:section/:id — update item in array section
app.put('/api/admin/pm/:section/:id', requireAdminRole, async (req, res) => {
  const { section, id } = req.params;
  if (!PM_ARRAY_SECTIONS.has(section)) return res.status(400).json({ error: 'Invalid section' });
  try {
    const existing = await readSharedCollection('program_management');
    const arr = Array.isArray(existing[section]) ? existing[section] : [];
    const idx = arr.findIndex(item => item.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    const item = { ...arr[idx], ...req.body, id };
    const newArr = [...arr.slice(0, idx), item, ...arr.slice(idx + 1)];
    await writeCollection('program_management', { ...existing, [section]: newArr });
    res.json(item);
  } catch {
    res.status(500).json({ error: `Unable to update ${section} item` });
  }
});

// DELETE /api/admin/pm/:section/:id — remove item from array section
app.delete('/api/admin/pm/:section/:id', requireAdminRole, async (req, res) => {
  const { section, id } = req.params;
  if (!PM_ARRAY_SECTIONS.has(section)) return res.status(400).json({ error: 'Invalid section' });
  try {
    const existing = await readSharedCollection('program_management');
    const arr = Array.isArray(existing[section]) ? existing[section] : [];
    const newArr = arr.filter(item => item.id !== id);
    if (newArr.length === arr.length) return res.status(404).json({ error: 'Item not found' });
    await writeCollection('program_management', { ...existing, [section]: newArr });
    res.json({ deleted: id });
  } catch {
    res.status(500).json({ error: `Unable to delete ${section} item` });
  }
});

// PUT /api/admin/settings — update nexus app settings
app.put('/api/admin/settings', requireAdminRole, async (req, res) => {
  try {
    await writeCollection('nexus_settings', req.body || {});
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to update settings' });
  }
});

// ── Serve SPA ──────────────────────────────────────────────────────────────────

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

seedDefaults().catch(err => console.error('[NEXUS seed]', err.message));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NEXUS] running on http://localhost:${PORT}`);
});
