'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../../../packages/db/src/index');
const { ALL_APPS, getAllowedApps, mergeAllowedApps, normalizeApps } = require('../../../packages/db/src/appAccess');
const { listAccessRequests, updateAccessRequest } = require('../../../packages/db/src/accessRequests');

const router = express.Router();

function adminOnly(req, res, next) {
  if ((req.session && req.session.user && req.session.user.role) !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function pickUser(row) {
  return {
    id: row.id,
    name: row.name,
    title: row.title || '',
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    siteId: row.siteId || null,
    siteIds: Array.isArray(row.siteIds) ? row.siteIds : [],
    allowedApps: getAllowedApps(row),
  };
}

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

  const desiredApps = normalizeApps(matches.reduce((apps, entry) => apps.concat(['hub', entry.appId]), getAllowedApps(user)));
  const updatedUser = await db.user.update({
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

router.post('/users', adminOnly, async (req, res) => {
  try {
    const { id, name, title, username, email, password, role, status, siteId, siteIds } = req.body || {};
    if (!id || !name || !username || !email || !password) {
      return res.status(400).json({ error: 'id, name, username, email, and password are required' });
    }
    const normalizedUsername = String(username).toLowerCase().trim();
    const normalizedEmail = String(email).toLowerCase().trim();
    const mergedSiteIds = [...new Set([...(Array.isArray(siteIds) ? siteIds : []), siteId].filter(Boolean).map(String))];
    const passwordHash = await bcrypt.hash(password, 12);
    let doc = await db.user.create({
      data: {
        id: String(id).trim(),
        name: String(name).trim(),
        title: title || null,
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        role: role || 'Viewer',
        status: status || 'Active',
        siteId: mergedSiteIds[0] || null,
        siteIds: mergedSiteIds,
        dod8140: mergeAllowedApps(null, normalizeApps(req.body.allowedApps || ['hub'])),
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

    const data = {};
    const nextSiteIds = [...new Set([
      ...(Array.isArray(req.body.siteIds) ? req.body.siteIds : []),
      req.body.siteId,
    ].filter(Boolean).map(String))];

    if ('name' in req.body) data.name = req.body.name;
    if ('title' in req.body) data.title = req.body.title || null;
    if ('role' in req.body) data.role = req.body.role || current.role;
    if ('status' in req.body) data.status = req.body.status || current.status;
    if ('siteId' in req.body || 'siteIds' in req.body) {
      data.siteId = nextSiteIds[0] || null;
      data.siteIds = nextSiteIds;
    }
    if (Array.isArray(req.body.allowedApps)) {
      data.dod8140 = mergeAllowedApps(current.dod8140, req.body.allowedApps);
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
    const status = String((req.body && req.body.status) || '').trim().toLowerCase();
    const reviewNotes = String((req.body && req.body.reviewNotes) || '').trim();
    if (!['pending', 'approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, approved, or denied' });
    }

    const requests = await listAccessRequests();
    const current = requests.find(entry => entry.id === req.params.id);
    if (!current) return res.status(404).json({ error: 'Request not found' });

    if (status === 'pending') {
      const reopened = await updateAccessRequest(current.id, {
        status: 'pending',
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes,
        matchedUserId: null,
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
      where: {
        OR: [
          { username: current.username },
          { email: current.email },
        ],
      },
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
        ok: true,
        request: pendingUser,
        message: 'Request approved, but the HUB user does not exist yet. Create the user record to finish access grant.',
      });
    }

    const updatedUser = await db.user.update({
      where: { id: matchingUser.id },
      data: {
        dod8140: mergeAllowedApps(matchingUser.dod8140, normalizeApps(getAllowedApps(matchingUser).concat(['hub', current.appId]))),
      },
    });
    const approved = await updateAccessRequest(current.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.session.user.username,
      reviewNotes,
      matchedUserId: updatedUser.id,
    });
    return res.json({
      ok: true,
      request: approved,
      user: pickUser(updatedUser),
      message: `Granted HUB and ${current.appLabel} access to ${updatedUser.username}.`,
    });
  } catch (err) {
    console.error('[HUB admin review request]', err.message);
    res.status(500).json({ error: 'Unable to review access request' });
  }
});

module.exports = router;
