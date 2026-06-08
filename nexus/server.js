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
const SNAPSHOT_REFRESH_MS = parseInt(process.env.NEXUS_SNAPSHOT_REFRESH_MS || `${6 * 60 * 60 * 1000}`, 10);
const SNAPSHOT_MAX_AGE_MS = parseInt(process.env.NEXUS_SNAPSHOT_MAX_AGE_MS || `${20 * 60 * 60 * 1000}`, 10);
const HUB_URL = process.env.HUB_URL || null;
const HUB_HOST = process.env.HUB_HOST || '127.0.0.1';
const HUB_PORT = parseInt(process.env.HUB_PORT || '3010', 10);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const COLLECTIONS = ['program_management', 'program_security', 'nexus_settings'];
const PM_ARRAY_SECTIONS = new Set(['realEstate', 'construction', 'accreditations', 'milestones', 'risks', 'executiveActions']);
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

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isWithinDateWindow(value, start, end) {
  const parsed = parseDateValue(value);
  if (!parsed) return false;
  return parsed >= start && parsed <= end;
}

function isBeforeDate(value, point) {
  const parsed = parseDateValue(value);
  if (!parsed) return false;
  return parsed < point;
}

function isOpenStatus(value) {
  return !['closed', 'complete', 'completed', 'resolved', 'cancelled', 'canceled', 'dismissed'].includes(String(value || '').toLowerCase());
}

function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function average(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function shortDate(value) {
  const parsed = parseDateValue(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildTrendMetric(current, previous, preference = 'lower', options = {}) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const delta = current - previous;
  const direction = delta === 0
    ? 'flat'
    : preference === 'higher'
      ? (delta > 0 ? 'improving' : 'degrading')
      : (delta < 0 ? 'improving' : 'degrading');
  const absDelta = Math.abs(delta);
  const suffix = options.suffix || '';
  const baseline = options.baselineAt ? shortDate(options.baselineAt) : null;
  const formatted = suffix === '%'
    ? `${delta > 0 ? '+' : delta < 0 ? '-' : ''}${absDelta}%`
    : `${delta > 0 ? '+' : delta < 0 ? '-' : ''}${absDelta}`;
  return {
    current,
    previous,
    delta,
    direction,
    label: baseline ? `${formatted} vs ${baseline}` : formatted,
  };
}

function countOpenItems(items, closedStatuses = ['closed', 'complete', 'completed', 'resolved']) {
  return (Array.isArray(items) ? items : []).filter(item => {
    const status = String(item?.status || '').toLowerCase();
    return !closedStatuses.includes(status);
  }).length;
}

function buildProgramMetrics(programManagement) {
  const portfolio = programManagement?.portfolio || {};
  const kpis = Array.isArray(portfolio.kpis) ? portfolio.kpis : [];
  const risks = Array.isArray(programManagement?.risks) ? programManagement.risks : [];
  const executiveActions = Array.isArray(programManagement?.executiveActions) ? programManagement.executiveActions : [];
  const milestones = Array.isArray(programManagement?.milestones) ? programManagement.milestones : [];
  const construction = Array.isArray(programManagement?.construction) ? programManagement.construction : [];
  const accreditations = Array.isArray(programManagement?.accreditations) ? programManagement.accreditations : [];
  const realEstate = Array.isArray(programManagement?.realEstate) ? programManagement.realEstate : [];

  const budgetHealthKpi = kpis.find(item => item.id === 'budget-health');
  const budgetHealth = Number.isFinite(Number(budgetHealthKpi?.value))
    ? clampPercent(Number(budgetHealthKpi.value))
    : (portfolio.budgetTotal > 0 ? clampPercent((Number(portfolio.budgetObligated || 0) / Number(portfolio.budgetTotal || 1)) * 100) : null);
  const openRisks = countOpenItems(risks, ['closed', 'accepted']);
  const executiveActionsOpen = countOpenItems(executiveActions, ['closed', 'complete', 'completed']);
  const criticalMilestones = milestones.filter(item => /critical|overdue|behind|risk/.test(String(item.status || '').toLowerCase())).length;
  const avgConstructionProgress = average(construction.map(item => Number(item.progress || 0))) ?? 70;

  const riskScore = clampPercent(100 - (openRisks * 14) - (criticalMilestones * 18));
  const actionScore = clampPercent(100 - (executiveActionsOpen * 10));
  const programScore = clampPercent(
    ((budgetHealth ?? 70) * 0.35)
    + (riskScore * 0.35)
    + (actionScore * 0.15)
    + (avgConstructionProgress * 0.15)
  );

  return {
    programScore,
    budgetHealth,
    openRisks,
    executiveActionsOpen,
    criticalMilestones,
    constructionActive: construction.length,
    accreditationsOpen: countOpenItems(accreditations, ['closed', 'complete', 'completed', 'accredited']),
    realEstateActions: countOpenItems(realEstate, ['closed', 'complete', 'completed']),
  };
}

function buildSecurityMetrics(programSecurity) {
  const summary = programSecurity?.facilitySecurity?.summary || {};
  const training = programSecurity?.personnelSecurity?.training || {};
  const visits = programSecurity?.personnelSecurity?.visitAccessRequests || {};
  const documents = programSecurity?.documentControl || {};
  const dd254 = programSecurity?.dd254 || {};
  const media = programSecurity?.mediaControl || {};
  const inspections = programSecurity?.selfInspections || {};
  const facilityAlerts = Number(programSecurity?.facilitySecurity?.idsIssueCount || 0) + Number(programSecurity?.facilitySecurity?.overdueFindings || 0);
  const mediaExceptions = Number(media.overdueReturns || 0) + Number(media.flagged || 0) + Number(media.pendingDestruction || 0);
  const openFindings = Number(programSecurity?.facilitySecurity?.openFindingsCount || 0) + Number(inspections.openFindings || 0);
  const dd254Actions = Number(dd254.actionable || 0) + Number(dd254.expiring30d || 0) + Number(dd254.reviewDue30d || 0);

  const postureScore = clampPercent(100 - (Number(summary.guarded || 0) * 8) - (Number(summary.elevated || 0) * 20) - (facilityAlerts * 6));
  const personnelScore = clampPercent(100 - (Number(training.overdue || 0) * 8) - (Number(visits.open || 0) * 2));
  const controlScore = clampPercent(100 - (Number(documents.inventoryOverdue || 0) * 6) - (mediaExceptions * 5) - (Number(inspections.overdue || 0) * 10) - (dd254Actions * 4));
  const securityScore = clampPercent((postureScore * 0.4) + (personnelScore * 0.3) + (controlScore * 0.3));

  return {
    securityScore,
    nominalFacilities: Number(summary.nominal || 0),
    guardedFacilities: Number(summary.guarded || 0),
    elevatedFacilities: Number(summary.elevated || 0),
    overdueTraining: Number(training.overdue || 0),
    visitRequests: Number(visits.open || 0),
    facilityAlerts,
    inventoryOverdue: Number(documents.inventoryOverdue || 0),
    dd254Actionable: Number(dd254.actionable || 0),
    dd254Expiring30d: Number(dd254.expiring30d || 0),
    dd254ReviewDue30d: Number(dd254.reviewDue30d || 0),
    mediaExceptions,
    inspectionOverdue: Number(inspections.overdue || 0),
    openFindings,
  };
}

function buildCyberMetrics(cyber) {
  if (!cyber || cyber._error) return null;
  const byStatus = cyber?.ato?.byStatus || {};
  const authorizedAtos = Number(byStatus.Active || 0) + Number(byStatus.Authorized || 0);
  const expiredAtos = Number(cyber?.ato?.expiration?.expired || 0);
  const controlCompliance = clampPercent(Number(cyber?.controlCompliance?.pct || 0));
  const remediationScore = clampPercent(100 - (Number(cyber?.poams?.open || 0) * 3) - (Number(cyber?.poams?.riskPending || 0) * 8));
  const sustainmentScore = clampPercent(100 - (Number(cyber?.conmon?.overdue || 0) * 8) - (Number(cyber?.saars?.pendingOver7d || 0) * 6) - (Number(cyber?.securityEvents?.criticalHigh || 0) * 10));
  const authorizationScore = clampPercent(100 - (expiredAtos * 25) - (Number(cyber?.ato?.expiration?.d30 || 0) * 5));
  const cyberScore = clampPercent(
    (authorizationScore * 0.25)
    + (controlCompliance * 0.3)
    + (remediationScore * 0.25)
    + (sustainmentScore * 0.2)
  );

  return {
    cyberScore,
    authorizedAtos,
    expiredAtos,
    openPoams: Number(cyber?.poams?.open || 0),
    controlCompliance,
    activeUsers: Number(cyber?.users?.active || 0),
    pendingSaars: Number(cyber?.saars?.pending || 0),
    conmonOverdue: Number(cyber?.conmon?.overdue || 0),
    criticalHighEvents: Number(cyber?.securityEvents?.criticalHigh || 0),
    hardwareReady: clampPercent(Number(cyber?.delivery?.hardwareProgress || 0)),
    pendingSaarsOver7d: Number(cyber?.saars?.pendingOver7d || 0),
  };
}

function resolveTrendSiteId(viewer) {
  if (!viewer) return null;
  if (viewer.canSeeAllSites || viewer.role === 'Corporate Admin' || viewer.role === 'Hub Admin') return null;
  return viewer.primarySiteId || viewer.siteId || (Array.isArray(viewer.siteIds) ? viewer.siteIds[0] : null) || null;
}

function buildSnapshotPayload(siteId, programManagement, programSecurity, cyber) {
  const program = buildProgramMetrics(programManagement);
  const security = buildSecurityMetrics(programSecurity);
  const cyberMetrics = buildCyberMetrics(cyber);
  return {
    siteId,
    cyberScore: cyberMetrics?.cyberScore ?? null,
    securityScore: security.securityScore,
    programScore: program.programScore,
    openPoams: cyberMetrics?.openPoams ?? null,
    authorizedAtos: cyberMetrics?.authorizedAtos ?? null,
    expiredAtos: cyberMetrics?.expiredAtos ?? null,
    openFindings: security.openFindings,
    nominalFacilities: security.nominalFacilities,
    overdueTraining: security.overdueTraining,
    pendingSaars: cyberMetrics?.pendingSaars ?? null,
    meta: {
      program,
      security,
      cyber: cyberMetrics,
    },
  };
}

async function readLatestSnapshot(siteId) {
  return db.nexusSnapshot.findFirst({
    where: { siteId: siteId ?? null },
    orderBy: { snapshotAt: 'desc' },
  });
}

function buildTrendPayload(current, baseline) {
  const baselineMeta = baseline?.meta || {};
  const currentProgram = buildProgramMetrics(current.programManagement);
  const currentSecurity = buildSecurityMetrics(current.programSecurity);
  const currentCyber = buildCyberMetrics(current.cyber);

  return {
    scopeSiteId: current.siteId ?? null,
    baselineAt: baseline?.snapshotAt || null,
    program: {
      programScore: buildTrendMetric(currentProgram.programScore, baselineMeta.program?.programScore, 'higher', { baselineAt: baseline?.snapshotAt, suffix: '%' }),
      budgetHealth: buildTrendMetric(currentProgram.budgetHealth, baselineMeta.program?.budgetHealth, 'higher', { baselineAt: baseline?.snapshotAt, suffix: '%' }),
      openRisks: buildTrendMetric(currentProgram.openRisks, baselineMeta.program?.openRisks, 'lower', { baselineAt: baseline?.snapshotAt }),
      executiveActionsOpen: buildTrendMetric(currentProgram.executiveActionsOpen, baselineMeta.program?.executiveActionsOpen, 'lower', { baselineAt: baseline?.snapshotAt }),
      criticalMilestones: buildTrendMetric(currentProgram.criticalMilestones, baselineMeta.program?.criticalMilestones, 'lower', { baselineAt: baseline?.snapshotAt }),
    },
    security: {
      securityScore: buildTrendMetric(currentSecurity.securityScore, baselineMeta.security?.securityScore, 'higher', { baselineAt: baseline?.snapshotAt, suffix: '%' }),
      nominalFacilities: buildTrendMetric(currentSecurity.nominalFacilities, baselineMeta.security?.nominalFacilities, 'higher', { baselineAt: baseline?.snapshotAt }),
      guardedFacilities: buildTrendMetric(currentSecurity.guardedFacilities, baselineMeta.security?.guardedFacilities, 'lower', { baselineAt: baseline?.snapshotAt }),
      overdueTraining: buildTrendMetric(currentSecurity.overdueTraining, baselineMeta.security?.overdueTraining, 'lower', { baselineAt: baseline?.snapshotAt }),
      visitRequests: buildTrendMetric(currentSecurity.visitRequests, baselineMeta.security?.visitRequests, 'lower', { baselineAt: baseline?.snapshotAt }),
    },
    cyber: {
      cyberScore: buildTrendMetric(currentCyber?.cyberScore, baselineMeta.cyber?.cyberScore, 'higher', { baselineAt: baseline?.snapshotAt, suffix: '%' }),
      openPoams: buildTrendMetric(currentCyber?.openPoams, baselineMeta.cyber?.openPoams, 'lower', { baselineAt: baseline?.snapshotAt }),
      controlCompliance: buildTrendMetric(currentCyber?.controlCompliance, baselineMeta.cyber?.controlCompliance, 'higher', { baselineAt: baseline?.snapshotAt, suffix: '%' }),
      activeUsers: buildTrendMetric(currentCyber?.activeUsers, baselineMeta.cyber?.activeUsers, 'higher', { baselineAt: baseline?.snapshotAt }),
      pendingSaars: buildTrendMetric(currentCyber?.pendingSaars, baselineMeta.cyber?.pendingSaars, 'lower', { baselineAt: baseline?.snapshotAt }),
      criticalHighEvents: buildTrendMetric(currentCyber?.criticalHighEvents, baselineMeta.cyber?.criticalHighEvents, 'lower', { baselineAt: baseline?.snapshotAt }),
      hardwareReady: buildTrendMetric(currentCyber?.hardwareReady, baselineMeta.cyber?.hardwareReady, 'higher', { baselineAt: baseline?.snapshotAt, suffix: '%' }),
    },
  };
}

function viewerForScope(siteId) {
  if (!siteId) {
    return { role: 'Hub Admin', canSeeAllSites: true, siteIds: [] };
  }
  return {
    role: 'Hub Viewer',
    canSeeAllSites: false,
    primarySiteId: siteId,
    siteId,
    siteIds: [siteId],
  };
}

async function snapshotScope(siteId) {
  const viewer = viewerForScope(siteId);
  const [programManagement, programSecurity, cyber] = await Promise.all([
    readSharedCollection('program_management'),
    buildSecurityRollup(viewer),
    buildCyberRollup(viewer),
  ]);
  const payload = buildSnapshotPayload(siteId, programManagement, programSecurity, cyber);
  await db.nexusSnapshot.create({ data: payload });
  return payload;
}

async function snapshotAllScopes() {
  const sites = await db.site.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  const scopes = [null, ...sites.map(site => site.id)];
  let created = 0;
  const failed = [];

  for (const siteId of scopes) {
    try {
      await snapshotScope(siteId);
      created += 1;
    } catch (err) {
      failed.push({ siteId, message: err.message });
    }
  }

  return { created, failed, scopeCount: scopes.length };
}

async function ensureRecentSnapshots() {
  const latest = await readLatestSnapshot(null);
  if (latest && (Date.now() - latest.snapshotAt.getTime()) < SNAPSHOT_MAX_AGE_MS) {
    return { skipped: true, latestSnapshotAt: latest.snapshotAt };
  }
  return snapshotAllScopes();
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
  let token = null;

  // Try Bearer token first
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  }
  // Fall back to httpOnly cookie
  else if (req.cookies?.nexus_auth) {
    token = req.cookies.nexus_auth;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — no token' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
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
  const in30 = addDays(now, 30);
  const in90 = addDays(now, 90);
  const todayStr = dateKey(now);
  const in30Str = dateKey(in30);

  const [facilities, personnel, activities, findings, documents, dd254s, media, inspections] = await Promise.all([
    db.mashFacilitySecurity.findMany({ where: siteFilter }),
    db.mashPersonnelSecurity.findMany({ where: siteFilter }),
    db.mashActivitiesSecurity.findMany({ where: siteFilter }),
    db.mashSecurityFinding.findMany({ where: siteFilter }),
    db.mashDocumentControl.findMany({ where: siteFilter }),
    db.mashDd254Register.findMany({ where: siteFilter }),
    db.mashMediaControl.findMany({ where: siteFilter }),
    db.mashSelfInspectionOp.findMany({ where: siteFilter }),
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
    const alarm = parseJsonField(f.alarmIDS) || {};
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
      idsAlarm: alarm.status || null,
      fclExpires: f.fclExpires || null,
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
  const foreignTravelDebriefPending = personnel.reduce((count, p) => {
    const trips = parseJsonField(p.foreignTravel) || [];
    return count + trips.filter(entry => entry && !entry.debriefed).length;
  }, 0);

  // Clearance breakdown
  const clearanceBreakdown = {};
  let activeClearances = 0;
  let pendingClearances = 0;
  let reinvestigationsDue = 0;
  let clearanceExpiring30d = 0;
  personnel.forEach(p => {
    const cs = (p.clearanceStatus || '').toLowerCase();
    if (cs === 'active') activeClearances++;
    if (['pending', 'in progress', 'submitted'].includes(cs)) pendingClearances++;
    if (p.clearancePRD && p.clearancePRD >= todayStr && p.clearancePRD <= in30Str) {
      reinvestigationsDue++;
      clearanceExpiring30d++;
    }
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

  const openFindings = findings.filter(f => isOpenStatus(f.status));
  const highOpenFindings = openFindings.filter(f => ['high', 'critical'].includes(String(f.severity || '').toLowerCase()));
  const overdueFindings = openFindings.filter(f => isBeforeDate(f.dueDate, now)).length;
  const totalActivities = activities.length;
  const openActivities = activities.filter(a => !['Completed', 'Cancelled'].includes(a.status || '')).length;
  const overdueActivities = activities.filter(a => isOpenStatus(a.status) && isBeforeDate(a.date, now)).length;
  const upcomingActivities30d = activities.filter(a => isOpenStatus(a.status) && isWithinDateWindow(a.date, now, in30)).length;

  const inventoryOverdue = documents.filter(d => isBeforeDate(d.nextInventory, now)).length;
  const statusExceptions = documents.filter(d => String(d.status || '').toLowerCase() !== 'active').length;
  const accountableTotal = documents.filter(d => d.accountable).length;
  const dd254Active = dd254s.filter(item => String(item.dd254Status || '').toLowerCase() === 'active').length;
  const dd254Expiring30d = dd254s.filter(item => isWithinDateWindow(item.expirationDate, now, in30)).length;
  const dd254ReviewDue30d = dd254s.filter(item => isWithinDateWindow(item.reviewDueDate, now, in30)).length;
  const dd254Actionable = dd254s.filter(item =>
    ['draft', 'pending review', 'revision required', 'expired'].includes(String(item.dd254Status || '').toLowerCase())
  ).length;
  const dd254Items = dd254s
    .map(item => ({
      id: item.id,
      contractNumber: item.contractNumber,
      programName: item.programName,
      customer: item.customer,
      status: item.dd254Status,
      expirationDate: item.expirationDate,
      reviewDueDate: item.reviewDueDate,
      owner: item.owner,
    }))
    .sort((a, b) => {
      const aDate = parseDateValue(a.reviewDueDate) || parseDateValue(a.expirationDate) || new Date('2999-12-31');
      const bDate = parseDateValue(b.reviewDueDate) || parseDateValue(b.expirationDate) || new Date('2999-12-31');
      return aDate - bDate;
    })
    .slice(0, 6);

  const overdueReturns = media.filter(item => isBeforeDate(item.returnDue, now) && !['returned', 'destroyed', 'closed'].includes(String(item.status || '').toLowerCase())).length;
  const pendingDestruction = media.filter(item => String(item.status || '').toLowerCase() === 'pending destruction').length;
  const flaggedMedia = media.filter(item => (parseJsonField(item.flags) || []).length > 0).length;

  const inspectionUpcoming90d = inspections.filter(item => isOpenStatus(item.status) && isWithinDateWindow(item.dueDate, now, in90)).length;
  const inspectionOverdue = inspections.filter(item => isOpenStatus(item.status) && isBeforeDate(item.dueDate, now)).length;
  const inspectionInProgress = inspections.filter(item => String(item.status || '').toLowerCase() === 'in progress').length;
  const inspectionRecentCompleted = inspections.filter(item => isWithinDateWindow(item.completedDate, addDays(now, -90), now)).length;
  const totalInspectionFindings = inspections.reduce((count, item) => count + (parseJsonField(item.findings) || []).length, 0);
  const idsIssueCount = facilityList.filter(item => item.idsAlarm && String(item.idsAlarm).toLowerCase() !== 'operational').length;
  const fclExpiring30d = facilities.filter(f => isWithinDateWindow(f.fclExpires, now, in30)).length;

  return {
    generatedAt: new Date().toISOString(),
    _source: 'live',
    facilitySecurity: {
      summary: facilityCounts,
      sites: facilityList,
      openFindingsCount: openFindings.length,
      highFindingsCount: highOpenFindings.length,
      overdueFindings,
      idsIssueCount,
      fclExpiring30d,
    },
    personnelSecurity: {
      training: { current: trainingCurrent, overdue: trainingOverdue, dueSoon: trainingDueSoon },
      visitAccessRequests: { open: openVisits, priority: priorityVisits, processedThisWeek: 0 },
      clearanceStatus: { active: activeClearances, pendingAdjudication: pendingClearances, reinvestigationsDue, ...clearanceBreakdown },
      clearanceExpiring30d,
      foreignTravelDebriefPending,
    },
    activitiesSecurity: {
      headline: totalActivities > 0
        ? `${openActivities} open across ${Object.keys(catMap).length} categor${Object.keys(catMap).length === 1 ? 'y' : 'ies'} — ${totalActivities} total tracked.`
        : null,
      categories: categoryList,
      openCount: openActivities,
      overdueCount: overdueActivities,
      upcoming30d: upcomingActivities30d,
    },
    documentControl: {
      accountableTotal,
      inventoryOverdue,
      statusExceptions,
    },
    dd254: {
      total: dd254s.length,
      active: dd254Active,
      expiring30d: dd254Expiring30d,
      reviewDue30d: dd254ReviewDue30d,
      actionable: dd254Actionable,
      items: dd254Items,
    },
    mediaControl: {
      total: media.length,
      overdueReturns,
      pendingDestruction,
      flagged: flaggedMedia,
    },
    selfInspections: {
      upcoming90d: inspectionUpcoming90d,
      overdue: inspectionOverdue,
      inProgress: inspectionInProgress,
      recentCompleted: inspectionRecentCompleted,
      openFindings: totalInspectionFindings,
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
  const soonWindow = addDays(now, 30);
  const in60 = addDays(now, 60);
  const in90 = addDays(now, 90);

  const [atos, poams, users, workstations, saars, systemRequests, assets, securityEvents, controls, conmons, agreements, licenses, yubiKeys, trackers] = await Promise.all([
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
        createdAt: true,
        accessExpiresAt: true,
        revalidationDueAt: true,
      },
    }),
    db.lavaSystemRequest.findMany({ where: siteFilter }),
    db.lavaAsset.findMany({ where: siteFilter }),
    db.securityEvent.findMany({ where: siteFilter, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.control.findMany({ where: siteFilter }),
    db.conMon.findMany({ where: siteFilter }),
    db.agreement.findMany({ where: siteFilter }),
    db.license.findMany({ where: siteFilter }),
    db.yubiKey.findMany({ where: siteFilter }),
    db.tracker.findMany({ where: siteFilter }),
  ]);

  const openPoams = poams.filter(item => isOpenStatus(item.status));
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
  const poamAging = openPoams.reduce((acc, item) => {
    const identified = parseDateValue(item.identifiedDate);
    if (!identified) return acc;
    const ageDays = Math.floor((now - identified) / (24 * 60 * 60 * 1000));
    if (ageDays > 90) acc.over90++;
    else if (ageDays > 60) acc.over60++;
    else if (ageDays > 30) acc.over30++;
    else acc.under30++;
    return acc;
  }, { under30: 0, over30: 0, over60: 0, over90: 0 });
  const poamRiskPending = openPoams.filter(item => ['submitted', 'pending', 'review'].includes(String(item.riskWorkflowState || '').toLowerCase())).length;

  const atoStatus = atos.reduce((acc, item) => {
    const key = item.status || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const atoExpirations = atos.reduce((acc, item) => {
    if (!item.expires) return acc;
    const expiry = parseDateValue(item.expires);
    if (!expiry) return acc;
    if (expiry < now) acc.expired++;
    else if (expiry <= soonWindow) acc.d30++;
    else if (expiry <= in60) acc.d60++;
    else if (expiry <= in90) acc.d90++;
    return acc;
  }, { d30: 0, d60: 0, d90: 0, expired: 0 });
  const expiringAtos = atoExpirations.d30;

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
  const controlCompliance = controls.reduce((acc, item) => {
    const status = String(item.status || '').toLowerCase();
    acc.total++;
    if (status === 'implemented') acc.implemented++;
    else if (status.includes('partial')) acc.partial++;
    else acc.notImplemented++;
    return acc;
  }, { total: 0, implemented: 0, partial: 0, notImplemented: 0 });
  controlCompliance.pct = controlCompliance.total
    ? Math.round((controlCompliance.implemented / controlCompliance.total) * 100)
    : 0;

  const conmonSummary = conmons.reduce((acc, item) => {
    acc.total++;
    if (isBeforeDate(item.dueDate, now) && isOpenStatus(item.status)) acc.overdue++;
    else if (isWithinDateWindow(item.dueDate, now, soonWindow) && isOpenStatus(item.status)) acc.dueSoon++;
    return acc;
  }, { total: 0, overdue: 0, dueSoon: 0 });

  const agreementExpirations = agreements.reduce((acc, item) => {
    if (isWithinDateWindow(item.expires, now, soonWindow)) acc.expiring30d++;
    else if (isWithinDateWindow(item.expires, addDays(now, 31), in60)) acc.expiring60d++;
    else if (isWithinDateWindow(item.expires, addDays(now, 61), in90)) acc.expiring90d++;
    return acc;
  }, { expiring30d: 0, expiring60d: 0, expiring90d: 0 });

  const licenseSummary = licenses.reduce((acc, item) => {
    if (isWithinDateWindow(item.expires, now, in90)) acc.expiring90d++;
    if ((item.used || 0) > (item.seats || 0)) acc.overCapacity++;
    return acc;
  }, { expiring90d: 0, overCapacity: 0 });

  const yubiKeySummary = yubiKeys.reduce((acc, item) => {
    if (String(item.status || '').toLowerCase() === 'unassigned') acc.unassigned++;
    if (String(item.status || '').toLowerCase().includes('lost') || String(item.status || '').toLowerCase().includes('destroyed')) acc.expired++;
    return acc;
  }, { unassigned: 0, expired: 0 });

  const trackerSummary = trackers.reduce((acc, item) => {
    if (isBeforeDate(item.nextDue, now) && isOpenStatus(item.status)) acc.overdue++;
    return acc;
  }, { overdue: 0 });

  const pendingSaarsOver7d = saars.filter(item =>
    String(item.status || '').toLowerCase() === 'pending'
    && Math.floor((now - new Date(item.createdAt)) / (24 * 60 * 60 * 1000)) > 7
  ).length;
  const revalidationDue30d = saars.filter(item => isWithinDateWindow(item.revalidationDueAt, now, soonWindow)).length;
  const accessExpiring30d = saars.filter(item => isWithinDateWindow(item.accessExpiresAt, now, soonWindow)).length;

  return {
    generatedAt: new Date().toISOString(),
    ato: {
      total: atos.length,
      expiringSoon: expiringAtos,
      expiration: atoExpirations,
      byStatus: atoStatus,
      systems: atos.slice(0, 6).map(item => ({
        id: item.id,
        system: item.system,
        status: item.status,
        expires: item.expires,
        siteId: item.siteId,
        openFindings: item.openFindings,
      })),
    },
    poams: {
      open: openPoams.length,
      bySeverity: poamSeverity,
      byAging: poamAging,
      riskPending: poamRiskPending,
      items: openPoams.slice(0, 6).map(item => ({
        id: item.id,
        title: item.title,
        severity: item.severity,
        status: item.status,
        siteId: item.siteId,
        dueDate: item.scheduledCompletion,
      })),
    },
    controlCompliance,
    conmon: conmonSummary,
    agreements: agreementExpirations,
    licenses: licenseSummary,
    users: {
      active: activeUsers.length,
      disabled: disabledUsers,
      pendingRequests: pendingSaars,
      overdueTraining,
      dueSoonTraining,
    },
    saars: {
      pending: pendingSaars,
      pendingOver7d: pendingSaarsOver7d,
      revalidationDue30d,
      accessExpiring30d,
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
    yubiKeys: yubiKeySummary,
    trackers: trackerSummary,
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
    res.cookie('nexus_auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
    });
    res.redirect('/');
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

    const trend = await buildTrendPayload({
      siteId: resolveTrendSiteId(req.user),
      programManagement,
      programSecurity,
      cyber: cyberResult,
    }, await readLatestSnapshot(resolveTrendSiteId(req.user)));

    res.json({
      settings,
      programManagement,
      programSecurity,
      cyber: cyberResult,
      trend,
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

app.get('/api/trend', async (req, res) => {
  try {
    const siteId = resolveTrendSiteId(req.user);
    const baseline = await readLatestSnapshot(siteId);
    const [programManagement, programSecurity, cyber] = await Promise.all([
      readSharedCollection('program_management'),
      buildSecurityRollup(req.user),
      buildCyberRollup(req.user).catch(err => ({ _error: err.message })),
    ]);
    res.json(buildTrendPayload({ siteId, programManagement, programSecurity, cyber }, baseline));
  } catch (err) {
    const status = err.status || 500;
    console.error('[NEXUS trend]', { user: req.user?.username, message: err.message });
    res.status(status).json({ error: err.message || 'Trend rollup failed' });
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

app.post('/api/admin/snapshot', requireAdminRole, async (_req, res) => {
  try {
    const result = await snapshotAllScopes();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[NEXUS snapshot]', err.message);
    res.status(500).json({ error: 'Unable to generate NEXUS snapshots' });
  }
});

// ── Serve SPA ──────────────────────────────────────────────────────────────────

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

seedDefaults()
  .then(() => ensureRecentSnapshots().catch(err => console.error('[NEXUS snapshot]', err.message)))
  .catch(err => console.error('[NEXUS seed]', err.message));

const snapshotTimer = setInterval(() => {
  ensureRecentSnapshots().catch(err => console.error('[NEXUS snapshot]', err.message));
}, SNAPSHOT_REFRESH_MS);
if (typeof snapshotTimer.unref === 'function') snapshotTimer.unref();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NEXUS] running on http://localhost:${PORT}`);
});
