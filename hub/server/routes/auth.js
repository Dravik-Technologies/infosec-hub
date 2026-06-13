'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { db }  = require('../../../packages/db/src/index');
const {
  getAllowedApps,
  hasAppAccess,
  getSecurityRole,
  getTitleFromSecurityRole,
  getDisplayRole,
  canSeeAllSites,
  normalizePlatformRole,
} = require('../../../packages/db/src/appAccess');
const { createAccessRequest, REQUESTABLE_APPS } = require('../../../packages/db/src/accessRequests');
const router  = express.Router();

const ENTRA_SCOPES = ['openid', 'profile', 'email'];

function authorityHost() {
  const configured = String(process.env.ENTRA_AUTHORITY_HOST || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  const redirect = String(process.env.ENTRA_REDIRECT_URI || '').trim().toLowerCase();
  if (redirect.includes('.azurecontainerapps.us') || redirect.includes('.usgov')) {
    return 'https://login.microsoftonline.us';
  }

  return 'https://login.microsoftonline.com';
}

function entraEnabled() {
  return Boolean(
    process.env.ENTRA_TENANT_ID
    && process.env.ENTRA_CLIENT_ID
    && process.env.ENTRA_CLIENT_SECRET
    && process.env.ENTRA_REDIRECT_URI
  );
}

function getMsalClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.ENTRA_CLIENT_ID,
      authority: `${authorityHost()}/${process.env.ENTRA_TENANT_ID}`,
      clientSecret: process.env.ENTRA_CLIENT_SECRET,
    },
    system: {
      loggerOptions: {
        piiLoggingEnabled: false,
        loggerCallback(level, message) {
          if (level <= 2) console.log(`[HUB ENTRA] ${message}`);
        },
      },
    },
  });
}

function redirectUri() {
  return process.env.ENTRA_REDIRECT_URI || 'http://localhost:3010/auth/entra/callback';
}

function buildSessionUser(found, extras) {
  const extra = extras || {};
  const securityRole = getSecurityRole(found) || null;
  const hubRole = normalizePlatformRole(found.role);
  const siteIds = Array.isArray(found.siteIds) ? found.siteIds : [];
  const primarySiteId = found.siteId || null;
  const allowedApps = getAllowedApps(found);
  return {
    authVersion:    3,
    id:             found.id,
    name:           found.name,
    username:       found.username,
    email:          found.email,
    hubRole:        hubRole,
    jobRole:        securityRole,
    primarySiteId:  primarySiteId,
    siteIds:        siteIds,
    allowedApps:    allowedApps,
    role:           hubRole,
    siteId:         primarySiteId,
    site:           primarySiteId,
    securityRole:   securityRole,
    title:          found.title || getTitleFromSecurityRole(securityRole) || null,
    displayRole:    getDisplayRole(found),
    canSeeAllSites: canSeeAllSites(found),
    initials:       found.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase(),
    authProvider:   extra.authProvider || 'local',
    entraOid:       extra.entraOid || null,
    entraTenantId:  extra.entraTenantId || null,
  };
}

async function findProvisionedUserFromClaims(claims) {
  const email = String(claims.preferred_username || claims.email || '').trim().toLowerCase();
  const loginName = email.includes('@') ? email.split('@')[0] : email;
  if (!email && !loginName) return null;

  return db.user.findFirst({
    where: {
      OR: [
        email ? { email } : undefined,
        loginName ? { username: loginName } : undefined,
      ].filter(Boolean),
    },
  });
}

function proxyLoginToScorva(username, password) {
  const scorvaBaseUrl = process.env.SCORVA_URL
    || `http://${process.env.SCORVA_HOST || '127.0.0.1'}:${parseInt(process.env.SCORVA_PORT || '3000', 10)}`;

  const loginUrl = new URL('/auth/login', scorvaBaseUrl);

  return fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
    .then(async res => {
      let parsed;
      try {
        parsed = await res.json();
      } catch {
        throw new Error('Bad response from SCORVA');
      }
      if (res.ok && parsed.user) return parsed.user;
      throw new Error(parsed.error || 'Invalid credentials');
    })
    .catch(err => {
      if (err.name === 'AbortError') throw new Error('SCORVA proxy timeout');
      throw err;
    });
}

router.get('/providers', (_req, res) => {
  res.json({
    local: true,
    entra: entraEnabled(),
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (process.env.ALLOW_DEV_LOGIN === 'true' && username === 'admin' && password === 'admin') {
    req.session.user = {
      authVersion: 3,
      id: 'dev-admin', name: 'Dev Admin', username: 'admin',
      email: 'admin@dev.local', hubRole: 'Hub Admin', role: 'Hub Admin',
      jobRole: null,
      primarySiteId: 'MTSI-VA',
      siteId: 'MTSI-VA',
      siteIds: ['MTSI-VA', 'MTSI-OH', 'MTSI-LV', 'MTSI-CO', 'MTSI-STL', 'MTSI-AL', 'MTSI-FL'],
      site: 'MTSI-VA',
      initials: 'DA',
      allowedApps: ['hub', 'scorva', 'crater', 'sentinel', 'lava', 'nexus'],
      securityRole: null, title: 'Hub Administrator', displayRole: 'Hub Administrator', canSeeAllSites: true,
      authProvider: 'local',
      entraOid: null,
      entraTenantId: null,
    };
    return req.session.save(() => res.json({ user: req.session.user }));
  }

  // Primary: authenticate against shared PostgreSQL Users table
  try {
    const found = await db.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (!found || found.status !== 'Active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, found.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    if (!hasAppAccess(found, 'hub')) {
      return res.status(403).json({ error: 'Hub access has not been granted for this account' });
    }

    req.session.user = buildSessionUser(found, { authProvider: 'local' });

    db.user.update({ where: { id: found.id }, data: { lastLogin: new Date() } }).catch(() => {});
    return req.session.save(() => res.json({ user: req.session.user }));
  } catch (err) {
    // Fallback: proxy to SCORVA if database is unreachable
    if ((err.message && err.message.includes('connect')) || err.code === 'P1001') {
      try {
        console.log('[HUB] DB offline — proxying login to SCORVA');
        const scorvaUser = await proxyLoginToScorva(username, password);
        req.session.user = {
          authVersion: 3,
          id:       scorvaUser.id || scorvaUser._id,
          name:     scorvaUser.name,
          username: scorvaUser.username,
          email:    scorvaUser.email,
          hubRole:  normalizePlatformRole(scorvaUser.role),
          role:     normalizePlatformRole(scorvaUser.role),
          jobRole:  scorvaUser.jobRole || scorvaUser.securityRole || null,
          primarySiteId: scorvaUser.primarySiteId || scorvaUser.siteId || scorvaUser.siteID || scorvaUser.site || null,
          siteId:   scorvaUser.primarySiteId || scorvaUser.siteId || scorvaUser.siteID || scorvaUser.site || null,
          siteIds:  Array.isArray(scorvaUser.siteIds || scorvaUser.siteIDs) ? (scorvaUser.siteIds || scorvaUser.siteIDs) : [],
          site:     scorvaUser.primarySiteId || scorvaUser.siteId || scorvaUser.siteID || scorvaUser.site || null,
          allowedApps: Array.isArray(scorvaUser.allowedApps) && scorvaUser.allowedApps.length
            ? scorvaUser.allowedApps
            : ['hub', 'scorva'],
          securityRole: scorvaUser.securityRole || scorvaUser.jobRole || null,
          title: scorvaUser.title || null,
          displayRole: scorvaUser.displayRole || scorvaUser.title || scorvaUser.jobRole || scorvaUser.securityRole || normalizePlatformRole(scorvaUser.role),
          canSeeAllSites: Boolean(scorvaUser.canSeeAllSites),
          initials: scorvaUser.initials ||
                    scorvaUser.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase(),
          authProvider: 'local',
          entraOid: null,
          entraTenantId: null,
        };
        return req.session.save(() => res.json({ user: req.session.user }));
      } catch (proxyErr) {
        if (proxyErr.message === 'Invalid credentials') {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        return res.status(503).json({ error: 'Authentication service unavailable.' });
      }
    }
    console.error('[HUB] DB login error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/entra/login', async (req, res) => {
  if (!entraEnabled()) {
    return res.status(503).json({ error: 'Microsoft Entra ID is not configured on the hub.' });
  }

  try {
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    req.session.entraAuth = { state, nonce };

    const authUrl = await getMsalClient().getAuthCodeUrl({
      scopes: ENTRA_SCOPES,
      redirectUri: redirectUri(),
      responseMode: 'query',
      state,
      nonce,
    });

    // Save session before redirect so entraAuth state persists
    return req.session.save((err) => {
      if (err) {
        console.error('[HUB] Session save error:', err.message);
        return res.redirect('/login?error=session_save_failed');
      }
      console.log('[HUB] Entra session saved, redirecting to Entra with state:', state);
      return res.redirect(authUrl);
    });
  } catch (err) {
    console.error('[HUB] Entra login init error:', err.message);
    return res.redirect('/login?error=entra_init_failed');
  }
});

router.get('/entra/callback', async (req, res) => {
  if (!entraEnabled()) {
    return res.redirect('/login?error=entra_not_configured');
  }

  const state = req.query && req.query.state ? String(req.query.state) : '';
  const code = req.query && req.query.code ? String(req.query.code) : '';
  const stored = req.session && req.session.entraAuth ? req.session.entraAuth : null;

  console.log('[HUB] Entra callback - state:', state ? state.slice(0, 8) : 'missing', 'stored:', stored ? stored.state.slice(0, 8) : 'missing', 'match:', stored && stored.state === state);

  if (!code || !stored || !state || stored.state !== state) {
    console.error('[HUB] Entra state validation failed:', { code: !!code, stored: !!stored, state: !!state, match: stored && stored.state === state });
    return res.redirect('/login?error=entra_state_invalid');
  }

  try {
    const result = await getMsalClient().acquireTokenByCode({
      code,
      scopes: ENTRA_SCOPES,
      redirectUri: redirectUri(),
    });

    const claims = result && result.idTokenClaims ? result.idTokenClaims : {};
    if (stored.nonce && claims.nonce && claims.nonce !== stored.nonce) {
      return res.redirect('/login?error=entra_nonce_invalid');
    }

    const found = await findProvisionedUserFromClaims(claims);
    if (!found || found.status !== 'Active') {
      return res.redirect('/login?error=entra_account_not_provisioned');
    }
    if (!hasAppAccess(found, 'hub')) {
      return res.redirect('/login?error=entra_hub_access_denied');
    }

    req.session.user = buildSessionUser(found, {
      authProvider: 'entra',
      entraOid: claims.oid || null,
      entraTenantId: claims.tid || null,
    });
    delete req.session.entraAuth;

    db.user.update({ where: { id: found.id }, data: { lastLogin: new Date() } }).catch(() => {});

    return req.session.save(() => res.redirect('/portal'));
  } catch (err) {
    console.error('[HUB] Entra callback error:', err.message);
    return res.redirect('/login?error=entra_callback_failed');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('hub.sid');
    res.json({ ok: true });
  });
});

router.get('/requestable-apps', (req, res) => {
  res.json({ apps: REQUESTABLE_APPS });
});

router.post('/request-access', async (req, res) => {
  try {
    const {
      appId, username, email, firstName, lastName,
      position, organization, phone, justification,
    } = req.body || {};

    if (!appId || !username || !email || !firstName || !lastName) {
      return res.status(400).json({
        error: 'appId, username, email, firstName, and lastName are required',
      });
    }

    const result = await createAccessRequest({
      appId,
      username,
      email,
      firstName,
      lastName,
      position,
      organization,
      phone,
      justification,
      sourceApp: appId,
    });

    if (!result.created) {
      return res.status(409).json({
        error: 'Access request already pending for this app',
        request: result.request,
      });
    }

    res.status(201).json({
      ok: true,
      message: 'Access request submitted successfully',
      request: result.request,
    });
  } catch (err) {
    console.error('[HUB request-access]', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
