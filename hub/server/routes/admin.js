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
  mergeAllowedApps,
  mergeAppFactory,
  normalizeApps,
  getSecurityRole,
  getTitleFromSecurityRole,
  canSeeAllSites,
} = require('../../../packages/db/src/appAccess');
const { listAccessRequests, updateAccessRequest } = require('../../../packages/db/src/accessRequests');

const router = express.Router();

/* ── Auth guards ── */

function corpAdminOnly(req, res, next) {
  if (req.session?.user?.role !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function adminOnly(req, res, next) {
  const role = req.session?.user?.role;
  if (role !== 'Corporate Admin' && role !== 'Access Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

/* ── Identity field validation ── */

async function getValidationError(body) {
  // Validate platform role if provided
  if ('role' in body && body.role && !PLATFORM_ROLES.includes(body.role)) {
    return `Invalid platform role. Must be one of: ${PLATFORM_ROLES.join(', ')}`;
  }
  // Validate security role if provided (null/empty allowed = clear the role)
  if ('securityRole' in body && body.securityRole && !SECURITY_ROLES.includes(body.securityRole)) {
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
  return {
    id:             row.id,
    name:           row.name,
    title:          getTitleFromSecurityRole(securityRole) || row.title || '',
    username:       row.username,
    email:          row.email,
    role:           row.role,
    status:         row.status,
    siteId:         row.siteId || null,
    siteIds:        Array.isArray(row.siteIds) ? row.siteIds : [],
    securityRole:   securityRole,
    allowedApps:    getAllowedApps(row),
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

  const securityRole = getSecurityRole(user);
  let updatedUser = user;

  if (!securityRole) {
    // Legacy path: no securityRole — write allowedApps explicitly
    const desiredApps = normalizeApps(
      matches.reduce((apps, entry) => apps.concat(['hub', entry.appId]), getAllowedApps(user))
    );
    updatedUser = await db.user.update({
      where: { id: user.id },
      data: { dod8140: mergeAllowedApps(user.dod8140, desiredApps) },
    });
  }
  // If user has securityRole, app access is role-derived — no dod8140 write needed

  const fulfilledRequests = [];
  for (const request of matches) {
    const roleCoversApp = securityRole
      ? getAllowedApps(updatedUser).includes(request.appId)
      : true;
    const defaultNote = securityRole && !roleCoversApp
      ? `Approved — note: ${request.appId} is not in the user's Security Role (${securityRole}). Update their Security Role to grant access.`
      : 'Approved request fulfilled after user account creation.';
    const updatedRequest = await updateAccessRequest(request.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: actorUsername || request.reviewedBy,
      reviewNotes: request.reviewNotes || defaultNote,
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

    const securityRole = req.body.securityRole || null;
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
        role:         role || 'Viewer',
        status:       status || 'Active',
        siteId:       mergedSiteIds[0] || null,
        siteIds:      mergedSiteIds,
        // Only store securityRole — allowedApps is derived at runtime by getAllowedApps()
        dod8140: mergeAppFactory(null, { securityRole }),
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
    if ('role'   in req.body) {
      if (req.session?.user?.role !== 'Corporate Admin') {
        return res.status(403).json({ error: 'Only Corporate Admin can change platform roles' });
      }
      data.role = req.body.role || current.role;
    }
    if ('status' in req.body) data.status = req.body.status || current.status;
    if ('siteId' in req.body || 'siteIds' in req.body) {
      data.siteId  = nextSiteIds[0] || null;
      data.siteIds = nextSiteIds;
    }

    // Only securityRole is stored — never explicit allowedApps (derived at runtime)
    if ('securityRole' in req.body) {
      const newSecRole = req.body.securityRole || null;
      data.title   = getTitleFromSecurityRole(newSecRole) || null;
      data.dod8140 = mergeAppFactory(current.dod8140, {
        securityRole: newSecRole,
        scorvaRole:   null, // clear legacy field when securityRole is updated
      });
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

    const matchSecurityRole = getSecurityRole(matchingUser);
    const roleCoversApp = matchSecurityRole
      ? getAllowedApps(matchingUser).includes(current.appId)
      : false;

    let updatedUser = matchingUser;
    if (!matchSecurityRole) {
      // Legacy path: no securityRole — write allowedApps explicitly
      updatedUser = await db.user.update({
        where: { id: matchingUser.id },
        data: {
          dod8140: mergeAllowedApps(
            matchingUser.dod8140,
            normalizeApps(getAllowedApps(matchingUser).concat(['hub', current.appId]))
          ),
        },
      });
    }
    // If user has securityRole, app access is role-derived — no dod8140 write needed

    const approved = await updateAccessRequest(current.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.session.user.username,
      reviewNotes,
      matchedUserId: updatedUser.id,
    });

    let message;
    if (matchSecurityRole) {
      message = roleCoversApp
        ? `Request approved. ${updatedUser.username} already has ${current.appLabel} access via their Security Role (${matchSecurityRole}).`
        : `Request approved — but ${current.appLabel} is not in ${updatedUser.username}'s Security Role (${matchSecurityRole}). Update their Security Role to grant access.`;
    } else {
      message = `Granted HUB and ${current.appLabel} access to ${updatedUser.username}.`;
    }

    return res.json({ ok: true, request: approved, user: pickUser(updatedUser), message });
  } catch (err) {
    console.error('[HUB admin review request]', err.message);
    res.status(500).json({ error: 'Unable to review access request' });
  }
});

module.exports = router;
