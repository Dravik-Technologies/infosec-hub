'use strict';

const ALL_APPS = ['hub', 'scorva', 'crater', 'mash', 'lava', 'nexus'];

/* ── Platform roles (HUB admin authority only) ── */
const PLATFORM_ROLES = ['Viewer', 'Access Admin', 'Corporate Admin'];

/* ── Security roles (operational, centralized) ── */
const SECURITY_ROLES = [
  'Executive',
  'Program Manager',
  'Facility Security',
  'Personnel Security',
  'Activities Security',
  'Document Control',
  'Media Control',
  'Information Security',
  'Information Technology',
  'Corporate Security Admin',
];

/* ── Human display title for each security role ── */
const SECURITY_ROLE_TITLES = {
  'Executive':               'Executive',
  'Program Manager':         'Program Manager',
  'Facility Security':       'Facility Security Officer',
  'Personnel Security':      'Personnel Security Officer',
  'Activities Security':     'Activities Security Officer',
  'Document Control':        'Document Control Officer',
  'Media Control':           'Media Control Officer',
  'Information Security':    'Information Security',
  'Information Technology':  'Information Technology',
  'Corporate Security Admin':'Corporate Security Administrator',
};

/* ── Default app access per security role ── */
const SECURITY_ROLE_APPS = {
  'Executive':               ['hub', 'nexus', 'mash'],
  'Program Manager':         ['hub', 'nexus', 'mash'],
  'Facility Security':       ['hub', 'mash'],
  'Personnel Security':      ['hub', 'mash'],
  'Activities Security':     ['hub', 'mash'],
  'Document Control':        ['hub', 'mash'],
  'Media Control':           ['hub', 'mash'],
  'Information Security':    ['hub', 'scorva', 'mash', 'nexus'],
  'Information Technology':  ['hub', 'scorva', 'lava', 'nexus'],
  'Corporate Security Admin':['hub', 'scorva', 'crater', 'mash', 'lava', 'nexus'],
};

/* ── Known controlled site list ── */
const KNOWN_SITES = [
  { id: 'MTSI-ALX', label: 'MTSI Alexandria' },
  { id: 'MTSI-HVL', label: 'MTSI Huntsville' },
];

/* ── The corporate HQ site that grants all-site visibility when paired with an admin role ── */
const CORP_SITE_ID = 'MTSI-ALX';

/* ── Legacy SCORVA_ROLES kept for backward compatibility only ── */
const SCORVA_ROLES = ['Viewer', 'ISSO', 'ISSM', 'Site Admin', 'Corporate Admin'];

function normalizeApps(input) {
  const list = Array.isArray(input) ? input : [];
  return [...new Set(list.map(v => String(v || '').trim().toLowerCase()).filter(Boolean))];
}

function readAppFactoryMeta(userOrMeta) {
  const meta = userOrMeta && typeof userOrMeta === 'object' && !Array.isArray(userOrMeta)
    ? userOrMeta
    : {};
  const container = meta.dod8140 && typeof meta.dod8140 === 'object' && !Array.isArray(meta.dod8140)
    ? meta.dod8140
    : meta;
  const appFactory = container.appFactory && typeof container.appFactory === 'object' && !Array.isArray(container.appFactory)
    ? container.appFactory
    : {};
  return { container, appFactory };
}

/* ── Security role helpers ── */

function getSecurityRole(user) {
  const { appFactory } = readAppFactoryMeta(user);
  return appFactory.securityRole || null;
}

function getTitleFromSecurityRole(securityRole) {
  if (!securityRole) return null;
  return SECURITY_ROLE_TITLES[securityRole] || securityRole;
}

function defaultAllowedAppsForRole(securityRole) {
  if (!securityRole) return null;
  return SECURITY_ROLE_APPS[securityRole] || null;
}

function getAllowedApps(user) {
  const platformRole = String((user && user.role) || '').toLowerCase();
  if (platformRole === 'corporate admin') return [...ALL_APPS];
  // Security role is authoritative when set — stored allowedApps are ignored
  const secRole = getSecurityRole(user);
  if (secRole) return SECURITY_ROLE_APPS[secRole] || ['hub'];
  // Migration fallback: honor explicitly stored allowedApps for users without securityRole
  const { appFactory } = readAppFactoryMeta(user);
  const explicit = normalizeApps(appFactory.allowedApps);
  if (explicit.length) return explicit;
  return ['hub'];
}

function hasAppAccess(user, appId) {
  if (!user || !appId) return false;
  return getAllowedApps(user).includes(String(appId).toLowerCase());
}

/* ── All-site visibility: user must belong to the corp site AND hold an admin-level role ── */
function canSeeAllSites(user) {
  if (!user) return false;
  const siteIds = Array.isArray(user.siteIds) ? user.siteIds : [];
  if (!siteIds.includes(CORP_SITE_ID) && user.siteId !== CORP_SITE_ID) return false;
  const platformRole = String(user.role || '').toLowerCase();
  const secRole = getSecurityRole(user) || user.securityRole || '';
  return (
    platformRole === 'corporate admin' ||
    secRole === 'Corporate Security Admin'
  );
}

/* ── dod8140 mutation helpers ── */

function mergeAllowedApps(dod8140, allowedApps) {
  const base = dod8140 && typeof dod8140 === 'object' && !Array.isArray(dod8140)
    ? { ...dod8140 }
    : {};
  const appFactory = base.appFactory && typeof base.appFactory === 'object' && !Array.isArray(base.appFactory)
    ? { ...base.appFactory }
    : {};
  return {
    ...base,
    appFactory: {
      ...appFactory,
      allowedApps: normalizeApps(allowedApps),
    },
  };
}

function ensureAppAccess(dod8140, appId) {
  const current = getAllowedApps({ dod8140, role: null });
  const next = current.includes(appId) ? current : current.concat(appId);
  return mergeAllowedApps(dod8140, next);
}

function mergeAppFactory(dod8140, patch) {
  const base = (dod8140 && typeof dod8140 === 'object' && !Array.isArray(dod8140))
    ? { ...dod8140 } : {};
  const appFactory = (base.appFactory && typeof base.appFactory === 'object' && !Array.isArray(base.appFactory))
    ? { ...base.appFactory } : {};
  return { ...base, appFactory: { ...appFactory, ...patch } };
}

/* ── Legacy scorvaRole accessor — reads from securityRole if present, falls back to stored scorvaRole ── */
function getScorvaRole(user) {
  const { appFactory } = readAppFactoryMeta(user);
  // If a new-model securityRole is set, derive a scorvaRole for backward compat
  if (appFactory.securityRole) {
    const sr = appFactory.securityRole;
    if (sr === 'Corporate Security Admin') return 'Corporate Admin';
    if (sr === 'Information Security') return 'ISSM';
    if (sr === 'Information Technology') return 'ISSO';
    if (sr === 'Facility Security' || sr === 'Personnel Security' || sr === 'Activities Security' ||
        sr === 'Document Control' || sr === 'Media Control') return 'Site Admin';
    return 'Viewer';
  }
  return appFactory.scorvaRole || null;
}

module.exports = {
  ALL_APPS,
  PLATFORM_ROLES,
  SECURITY_ROLES,
  SECURITY_ROLE_TITLES,
  SECURITY_ROLE_APPS,
  KNOWN_SITES,
  CORP_SITE_ID,
  SCORVA_ROLES,
  getAllowedApps,
  hasAppAccess,
  mergeAllowedApps,
  mergeAppFactory,
  ensureAppAccess,
  normalizeApps,
  getSecurityRole,
  getTitleFromSecurityRole,
  defaultAllowedAppsForRole,
  canSeeAllSites,
  getScorvaRole,
};
