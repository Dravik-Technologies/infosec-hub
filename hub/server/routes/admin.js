'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../../packages/db/src/index');
const {
  ALL_APPS,
  PLATFORM_ROLES,
  SECURITY_ROLES,
  SECURITY_ROLE_TITLES,
  SECURITY_ROLE_APPS,
  getAllowedApps,
  getStoredAllowedApps,
  mergeAllowedApps,
  mergeAppFactory,
  normalizeApps,
  normalizePlatformRole,
  isHubAdmin,
  getSecurityRole,
  getTitleFromSecurityRole,
  canSeeAllSites,
} = require('../../../packages/db/src/appAccess');
const { listAccessRequests, updateAccessRequest } = require('../../../packages/db/src/accessRequests');

const router = express.Router();

/* ── Auth guards ── */

function corpAdminOnly(req, res, next) {
  if (!isHubAdmin(req.session?.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function adminOnly(req, res, next) {
  if (!isHubAdmin(req.session?.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

/* ── Identity field validation ── */

async function getValidationError(body) {
  const requestedJobRole = 'jobRole' in body ? body.jobRole : body.securityRole;
  // Validate platform role if provided
  if ('role' in body && body.role && !PLATFORM_ROLES.includes(body.role)) {
    return `Invalid platform role. Must be one of: ${PLATFORM_ROLES.join(', ')}`;
  }
  // Validate security role if provided (null/empty allowed = clear the role)
  if (requestedJobRole && !SECURITY_ROLES.includes(requestedJobRole)) {
    return `Invalid security role. Must be one of: ${SECURITY_ROLES.join(', ')}`;
  }
  // Validate site IDs against the database
  const needsSiteValidation =
    ('siteId' in body && body.siteId) ||
    ('siteIds' in body && Array.isArray(body.siteIds) && body.siteIds.length > 0);

  if (needsSiteValidation) {
    const knownSites = await db.site.findMany({ select: { id: true } });
    const siteSet = new Set(knownSites.map(s => s.id));

    if ('siteId' in body && body.siteId && !siteSet.has(body.siteId)) {
      return `Unknown site: ${body.siteId}`;
    }
    if ('siteIds' in body && Array.isArray(body.siteIds)) {
      const invalid = body.siteIds.filter(id => id && !siteSet.has(id));
      if (invalid.length) return `Unknown sites: ${invalid.join(', ')}`;
    }
  }
  return null;
}

/* ── User projection ── */

function pickUser(row) {
  const securityRole = getSecurityRole(row) || null;
  const defaultApps = SECURITY_ROLE_APPS[securityRole] || ['hub'];
  const derivedTitle = getTitleFromSecurityRole(securityRole) || '';
  const hubRole = normalizePlatformRole(row.role);
  const primarySiteId = row.siteId || null;
  const siteIds = Array.isArray(row.siteIds) ? row.siteIds : [];
  const allowedApps = getAllowedApps(row);
  return {
    authVersion:    3,
    id:             row.id,
    name:           row.name,
    title:          derivedTitle,
    username:       row.username,
    email:          row.email,
    hubRole:        hubRole,
    role:           hubRole,
    status:         row.status,
    primarySiteId:  primarySiteId,
    siteId:         primarySiteId,
    siteIds:        siteIds,
    jobRole:        securityRole,
    securityRole:   securityRole,
    allowedApps:    allowedApps,
    storedAllowedApps: getStoredAllowedApps(row),
    defaultAllowedApps: defaultApps,
    canSeeAllSites: canSeeAllSites(row),
  };
}

/* ── Access-request fulfillment (used after user creation) ── */

async function fulfillApprovedPendingRequests(user, actorUsername) {
  const requests = await listAccessRequests();
  const matches = requests.filter(entry =>
    entry.status === 'approved_pending_user' &&
    (
      (entry.username && entry.username === String(user.username || '').toLowerCase()) ||
      (entry.email && entry.email === String(user.email || '').toLowerCase())
    )
  );

  if (!matches.length) return { user, fulfilledRequests: [] };

  let updatedUser = user;
  const desiredApps = normalizeApps(
    matches.reduce((apps, entry) => apps.concat(['hub', entry.appId]), getAllowedApps(user))
  );
  updatedUser = await db.user.update({
    where: { id: user.id },
    data: { dod8140: mergeAllowedApps(user.dod8140, desiredApps) },
  });

  const fulfilledRequests = [];
  for (const request of matches) {
    const updatedRequest = await updateAccessRequest(request.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: actorUsername || request.reviewedBy,
      reviewNotes: request.reviewNotes || 'Approved request fulfilled after user account creation.',
      matchedUserId: updatedUser.id,
    });
    if (updatedRequest) fulfilledRequests.push(updatedRequest);
  }

  return { user: updatedUser, fulfilledRequests };
}

/* ── Routes ── */

/* Identity metadata — single source of truth served to client */
router.get('/identity-meta', adminOnly, async (_req, res) => {
  try {
    const sites = await db.site.findMany({ orderBy: { id: 'asc' } });
    res.json({
      platformRoles:      PLATFORM_ROLES,
      securityRoles:      SECURITY_ROLES,
      securityRoleTitles: SECURITY_ROLE_TITLES,
      securityRoleApps:   SECURITY_ROLE_APPS,
      allApps:            ALL_APPS,
      sites:              sites.map(s => ({ id: s.id, label: s.label })),
    });
  } catch (err) {
    console.error('[HUB admin identity-meta]', err.message);
    res.status(500).json({ error: 'Unable to load identity metadata' });
  }
});

router.get('/users', adminOnly, async (_req, res) => {
  try {
    const users = await db.user.findMany({
      orderBy: [{ name: 'asc' }, { username: 'asc' }],
    });
    res.json({ apps: ALL_APPS, users: users.map(pickUser) });
  } catch (err) {
    console.error('[HUB admin users]', err.message);
    res.status(500).json({ error: 'Unable to load users' });
  }
});

router.get('/access-requests', adminOnly, async (_req, res) => {
  try {
    const requests = await listAccessRequests();
    res.json({ requests });
  } catch (err) {
    console.error('[HUB admin requests]', err.message);
    res.status(500).json({ error: 'Unable to load access requests' });
  }
});

router.post('/users', corpAdminOnly, async (req, res) => {
  try {
    const { id, name, username, email, password, role, status, siteId, siteIds } = req.body || {};
    if (!id || !name || !username || !email || !password) {
      return res.status(400).json({ error: 'id, name, username, email, and password are required' });
    }

    const validationError = await getValidationError(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const normalizedUsername = String(username).toLowerCase().trim();
    const normalizedEmail    = String(email).toLowerCase().trim();
    const mergedSiteIds      = [...new Set([...(Array.isArray(siteIds) ? siteIds : []), siteId].filter(Boolean).map(String))];

    const securityRole = req.body.jobRole || req.body.securityRole || null;
    const explicitAllowedApps = normalizeApps(req.body.allowedApps);
    const derivedTitle = getTitleFromSecurityRole(securityRole) || null;
    const passwordHash = await bcrypt.hash(password, 12);
    let doc = await db.user.create({
      data: {
        id:           String(id).trim(),
        name:         String(name).trim(),
        title:        derivedTitle,
        username:     normalizedUsername,
        email:        normalizedEmail,
        passwordHash,
        role:         normalizePlatformRole(role || 'Hub Viewer'),
        status:       status || 'Active',
        siteId:       mergedSiteIds[0] || null,
        siteIds:      mergedSiteIds,
        dod8140: mergeAppFactory(
          mergeAllowedApps(null, explicitAllowedApps.length ? explicitAllowedApps : ['hub']),
          { securityRole }
        ),
      },
    });

    const fulfilled = await fulfillApprovedPendingRequests(doc, req.session.user.username);
    doc = fulfilled.user;
    res.status(201).json({
      ok: true,
      user: pickUser(doc),
      fulfilledRequests: fulfilled.fulfilledRequests,
    });
  } catch (err) {
    console.error('[HUB admin create user]', err.message);
    res.status(500).json({ error: 'Unable to create user' });
  }
});

// Helper: compare arrays as sets (order-insensitive)
function arraysEqualAsSet(a, b) {
  const aSet = new Set((a || []).map(String));
  const bSet = new Set((b || []).map(String));
  if (aSet.size !== bSet.size) return false;
  for (const item of aSet) {
    if (!bSet.has(item)) return false;
  }
  return true;
}

router.patch('/users/:id', adminOnly, async (req, res) => {
  try {
    const current = await db.user.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'User not found' });

    const validationError = await getValidationError(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const data = {};
    const nextSiteIds = [...new Set([
      ...(Array.isArray(req.body.siteIds) ? req.body.siteIds : []),
      req.body.siteId,
    ].filter(Boolean).map(String))];

    if ('name'   in req.body) data.name   = req.body.name;

    let shouldRevokeTokens = false;

    if ('role'   in req.body) {
      if (!isHubAdmin(req.session?.user)) {
        return res.status(403).json({ error: 'Only Hub Admin can change platform roles' });
      }
      const newRole = normalizePlatformRole(req.body.role || current.role);
      if (newRole !== current.role) {
        data.role = newRole;
        shouldRevokeTokens = true;
      }
    }
    if ('status' in req.body) {
      const newStatus = req.body.status || current.status;
      if (newStatus !== current.status) {
        data.status = newStatus;
        shouldRevokeTokens = true;
      }
    }
    if ('siteId' in req.body || 'siteIds' in req.body) {
      const newPrimarySiteId = nextSiteIds[0] || null;
      const siteIdChanged = newPrimarySiteId !== current.siteId;
      const siteIdsChanged = !arraysEqualAsSet(nextSiteIds, current.siteIds || []);
      if (siteIdChanged || siteIdsChanged) {
        data.siteId  = newPrimarySiteId;
        data.siteIds = nextSiteIds;
        shouldRevokeTokens = true;
      }
    }

    let nextDod8140 = current.dod8140;
    if ('securityRole' in req.body || 'jobRole' in req.body) {
      const newSecRole = req.body.jobRole || req.body.securityRole || null;
      const oldSecRole = current.securityRole || (current.dod8140?.securityRole) || null;
      if (newSecRole !== oldSecRole) {
        data.title = getTitleFromSecurityRole(newSecRole) || null;
        nextDod8140 = mergeAppFactory(nextDod8140, {
          securityRole: newSecRole,
          scorvaRole:   null, // clear legacy field when securityRole is updated
        });
        shouldRevokeTokens = true;
      }
    }
    if ('allowedApps' in req.body) {
      const oldAllowedApps = current.dod8140?.allowedApps || [];
      const newAllowedApps = Array.isArray(req.body.allowedApps) ? req.body.allowedApps : [];
      if (!arraysEqualAsSet(oldAllowedApps, newAllowedApps)) {
        nextDod8140 = mergeAllowedApps(nextDod8140, req.body.allowedApps);
        shouldRevokeTokens = true;
      }
    }
    if (nextDod8140 !== current.dod8140) data.dod8140 = nextDod8140;

    // Revoke all outstanding tokens if any permission/role/access changes
    if (shouldRevokeTokens) {
      data.tokenEpoch = (current.tokenEpoch || 0) + 1;
    }

    if (req.body.password) {
      data.passwordHash = await bcrypt.hash(req.body.password, 12);
    }

    const doc = await db.user.update({ where: { id: req.params.id }, data });
    res.json({ ok: true, user: pickUser(doc) });
  } catch (err) {
    console.error('[HUB admin update user]', err.message);
    res.status(500).json({ error: 'Unable to update user' });
  }
});

router.patch('/access-requests/:id', adminOnly, async (req, res) => {
  try {
    const status      = String((req.body && req.body.status) || '').trim().toLowerCase();
    const reviewNotes = String((req.body && req.body.reviewNotes) || '').trim();
    if (!['pending', 'approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, approved, or denied' });
    }

    const requests = await listAccessRequests();
    const current  = requests.find(entry => entry.id === req.params.id);
    if (!current) return res.status(404).json({ error: 'Request not found' });

    if (status === 'pending') {
      const reopened = await updateAccessRequest(current.id, {
        status: 'pending', reviewedAt: null, reviewedBy: null, reviewNotes, matchedUserId: null,
      });
      return res.json({ ok: true, request: reopened, message: 'Request returned to pending review.' });
    }

    if (status === 'denied') {
      const denied = await updateAccessRequest(current.id, {
        status: 'denied',
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.session.user.username,
        reviewNotes,
      });
      return res.json({ ok: true, request: denied, message: 'Request denied.' });
    }

    const matchingUser = await db.user.findFirst({
      where: { OR: [{ username: current.username }, { email: current.email }] },
    });

    if (!matchingUser) {
      const pendingUser = await updateAccessRequest(current.id, {
        status: 'approved_pending_user',
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.session.user.username,
        reviewNotes: reviewNotes || 'Approved pending HUB user creation.',
        matchedUserId: null,
      });
      return res.json({
        ok: true, request: pendingUser,
        message: 'Request approved, but the HUB user does not exist yet. Create the user record to finish access grant.',
      });
    }

    const updatedUser = await db.user.update({
      where: { id: matchingUser.id },
      data: {
        dod8140: mergeAllowedApps(
          matchingUser.dod8140,
          normalizeApps(getAllowedApps(matchingUser).concat(['hub', current.appId]))
        ),
      },
    });

    const approved = await updateAccessRequest(current.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.session.user.username,
      reviewNotes,
      matchedUserId: updatedUser.id,
    });

    const message = `Granted HUB and ${current.appLabel} access to ${updatedUser.username}.`;

    return res.json({ ok: true, request: approved, user: pickUser(updatedUser), message });
  } catch (err) {
    console.error('[HUB admin review request]', err.message);
    res.status(500).json({ error: 'Unable to review access request' });
  }
});

module.exports = router;
