'use strict';

const APP_ALIASES = {
  mash: 'sentinel',
  sentinel: 'sentinel',
};

const ALL_APPS = ['hub', 'scorva', 'crater', 'sentinel', 'lava', 'nexus'];

/* ── Platform roles (HUB admin authority only) ── */
const PLATFORM_ROLES = ['Hub Viewer', 'Hub User', 'Hub Admin'];
const LEGACY_PLATFORM_ROLE_MAP = {
  'Viewer': 'Hub Viewer',
  'Access Admin': 'Hub Admin',
  'Corporate Admin': 'Hub Admin',
  'Site Admin': 'Hub User',
};

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
  'Executive':               ['hub', 'nexus', 'sentinel'],
  'Program Manager':         ['hub', 'nexus', 'sentinel'],
  'Facility Security':       ['hub', 'sentinel'],
  'Personnel Security':      ['hub', 'sentinel'],
  'Activities Security':     ['hub', 'sentinel'],
  'Document Control':        ['hub', 'sentinel'],
  'Media Control':           ['hub', 'sentinel'],
  'Information Security':    ['hub', 'scorva', 'sentinel', 'nexus'],
  'Information Technology':  ['hub', 'scorva', 'lava', 'nexus'],
  'Corporate Security Admin':['hub', 'scorva', 'crater', 'sentinel', 'lava', 'nexus'],
};

/* ── Known controlled site list ── */
const KNOWN_SITES = [
  { id: 'MTSI-VA', label: 'MTSI Virginia' },
  { id: 'MTSI-OH', label: 'MTSI Ohio' },
  { id: 'MTSI-LV', label: 'MTSI Las Vegas' },
  { id: 'MTSI-CO', label: 'MTSI Colorado' },
  { id: 'MTSI-STL', label: 'MTSI St. Louis' },
  { id: 'MTSI-AL', label: 'MTSI Alabama' },
  { id: 'MTSI-FL', label: 'MTSI Florida' },
];

/* ── The corporate HQ site that grants all-site visibility when paired with an admin role ── */
const CORP_SITE_ID = 'MTSI-VA';

/* ── Legacy SCORVA_ROLES kept for backward compatibility only ── */
const SCORVA_ROLES = ['Viewer', 'ISSO', 'ISSM', 'Site Admin', 'Corporate Admin'];

function normalizeApps(input) {
  const list = Array.isArray(input) ? input : [];
  return [...new Set(list
    .map(v => String(v || '').trim().toLowerCase())
    .map(v => APP_ALIASES[v] || v)
    .filter(Boolean))];
}

function ensureHubAccess(apps) {
  const normalized = normalizeApps(apps);
  return normalized.includes('hub') ? normalized : ['hub', ...normalized];
}

function normalizePlatformRole(role) {
  const normalized = String(role || '').trim();
  if (PLATFORM_ROLES.includes(normalized)) return normalized;
  return LEGACY_PLATFORM_ROLE_MAP[normalized] || 'Hub Viewer';
}

function getLegacyPlatformRole(role) {
  switch (normalizePlatformRole(role)) {
    case 'Hub Admin':
      return 'Corporate Admin';
    case 'Hub User':
      return 'Site Admin';
    default:
      return 'Viewer';
  }
}

function isHubAdmin(userOrRole) {
  const role = typeof userOrRole === 'string'
    ? userOrRole
    : userOrRole && (userOrRole.hubRole || userOrRole.role);
  return normalizePlatformRole(role) === 'Hub Admin';
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
  const directRole = String(user?.securityRole || user?.jobRole || '').trim();
  if (directRole) return directRole;
  const { appFactory } = readAppFactoryMeta(user);
  return appFactory.securityRole || null;
}

function getTitleFromSecurityRole(securityRole) {
  if (!securityRole) return null;
  return SECURITY_ROLE_TITLES[securityRole] || securityRole;
}

function getDisplayRole(user) {
  if (!user) return null;
  const explicitTitle = String(user.title || '').trim();
  if (explicitTitle) return explicitTitle;

  const explicitJobRole = String(user.jobRole || user.securityRole || '').trim();
  if (explicitJobRole) {
    return getTitleFromSecurityRole(explicitJobRole) || explicitJobRole;
  }

  const modeledSecurityRole = getSecurityRole(user);
  if (modeledSecurityRole) {
    return getTitleFromSecurityRole(modeledSecurityRole) || modeledSecurityRole;
  }

  return normalizePlatformRole(user.hubRole || user.role);
}

function defaultAllowedAppsForRole(securityRole) {
  if (!securityRole) return null;
  return ensureHubAccess(SECURITY_ROLE_APPS[securityRole] || []);
}

function getStoredAllowedApps(user) {
  const directApps = normalizeApps(user?.allowedApps);
  if (directApps.length) return directApps;
  const { appFactory } = readAppFactoryMeta(user);
  return normalizeApps(appFactory.allowedApps);
}

function getAllowedApps(user) {
  if (isHubAdmin(user)) return [...ALL_APPS];

  const explicit = getStoredAllowedApps(user);
  if (explicit.length) return ensureHubAccess(explicit);

  const secRole = getSecurityRole(user);
  const defaults = defaultAllowedAppsForRole(secRole);
  if (defaults && defaults.length) return defaults;

  return ['hub'];
}

function hasAppAccess(user, appId) {
  if (!user || !appId) return false;
  const normalized = APP_ALIASES[String(appId).toLowerCase()] || String(appId).toLowerCase();
  return getAllowedApps(user).includes(normalized);
}

/* ── All-site visibility: user must belong to the corp site AND hold an admin-level role ── */
function canSeeAllSites(user) {
  if (!user) return false;
  return isHubAdmin(user);
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
      allowedApps: ensureHubAccess(allowedApps),
    },
  };
}

function ensureAppAccess(dod8140, appId) {
  const current = getStoredAllowedApps({ dod8140 });
  const normalized = APP_ALIASES[String(appId || '').trim().toLowerCase()] || String(appId || '').trim().toLowerCase();
  const next = current.includes(normalized) ? current : current.concat(normalized);
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
  APP_ALIASES,
  ALL_APPS,
  PLATFORM_ROLES,
  LEGACY_PLATFORM_ROLE_MAP,
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
  normalizePlatformRole,
  getLegacyPlatformRole,
  isHubAdmin,
  getSecurityRole,
  getTitleFromSecurityRole,
  getDisplayRole,
  defaultAllowedAppsForRole,
  getStoredAllowedApps,
  canSeeAllSites,
  getScorvaRole,
};
