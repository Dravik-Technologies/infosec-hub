'use strict';

const ALL_APPS = ['hub', 'scorva', 'crater', 'mash', 'lava'];

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

function defaultAllowedApps(user) {
  const role = String((user && user.role) || '').toLowerCase();
  if (role === 'corporate admin') return [...ALL_APPS];
  return ['hub'];
}

function getAllowedApps(user) {
  const { appFactory } = readAppFactoryMeta(user);
  const explicit = normalizeApps(appFactory.allowedApps);
  if (explicit.length) return explicit;
  return defaultAllowedApps(user);
}

function hasAppAccess(user, appId) {
  if (!user || !appId) return false;
  return getAllowedApps(user).includes(String(appId).toLowerCase());
}

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

function getScorvaRole(user) {
  const { appFactory } = readAppFactoryMeta(user);
  return appFactory.scorvaRole || null;
}

function mergeAppFactory(dod8140, patch) {
  const base = (dod8140 && typeof dod8140 === 'object' && !Array.isArray(dod8140))
    ? { ...dod8140 } : {};
  const appFactory = (base.appFactory && typeof base.appFactory === 'object' && !Array.isArray(base.appFactory))
    ? { ...base.appFactory } : {};
  return { ...base, appFactory: { ...appFactory, ...patch } };
}

module.exports = {
  ALL_APPS,
  SCORVA_ROLES,
  getAllowedApps,
  hasAppAccess,
  mergeAllowedApps,
  mergeAppFactory,
  ensureAppAccess,
  normalizeApps,
  getScorvaRole,
};
