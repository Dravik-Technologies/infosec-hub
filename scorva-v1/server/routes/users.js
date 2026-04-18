'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const audit = require('../middleware/audit');
const router = express.Router();

function adminOnly(req, res, next) {
  if ((req.user?.role || req.session?.user?.role) !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function normalizeSites(payload) {
  const fromArrays = []
    .concat(payload.siteIDs || [])
    .concat(payload.sites || []);
  const fromScalar = payload.siteID || payload.site || null;
  const merged = [...fromArrays, fromScalar].filter(Boolean).map(v => String(v).trim()).filter(Boolean);
  return [...new Set(merged)];
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await User.find(req.applyTenantFilter({})).sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await User.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', adminOnly, async (req, res, next) => {
  const { id, name, title, username, email, password, role, status, training_compliant, training_due, dod_8140 } = req.body;
  const manualId = (id || '').trim();
  const siteIDs = normalizeSites(req.body);
  const primarySiteID = siteIDs[0] || null;

  if (!manualId) return res.status(400).json({ error: 'id is required' });
  if (!password) return res.status(400).json({ error: 'password is required' });

  try {
    if (await User.exists({ _id: manualId })) {
      return res.status(409).json({ error: 'User ID already exists' });
    }

    const hash = await bcrypt.hash(password, 12);

    const doc = await User.create({
      _id: manualId,
      name,
      title,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password_hash: hash,
      role: role || 'Viewer',
      siteID: primarySiteID,
      siteIDs,
      site: primarySiteID,
      status: status || 'Active',
      training_compliant: training_compliant || false,
      training_due: training_due || '',
      dod_8140: dod_8140 || undefined,
    });

    await audit(req.session.user.username, 'USER_CREATE', manualId, `Created user: ${username}`, primarySiteID);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', adminOnly, async (req, res, next) => {
  const allowed = ['id', 'name', 'title', 'email', 'role', 'site', 'siteID', 'sites', 'siteIDs', 'status', 'yubikey', 'workstation', 'training_compliant', 'training_due', 'dod_8140'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (req.body.password) {
    updates.password_hash = await bcrypt.hash(req.body.password, 12);
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const requestedId = (updates.id || '').trim();
    delete updates.id;

    const siteIDs = normalizeSites(updates);
    if (siteIDs.length || 'site' in updates || 'siteID' in updates || 'sites' in updates || 'siteIDs' in updates) {
      updates.siteIDs = siteIDs;
      updates.siteID = siteIDs[0] || null;
      updates.site = siteIDs[0] || null;
    }
    delete updates.sites;

    const current = await User.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });

    // If ID changed, migrate record to new _id while preserving unique constraints.
    if (requestedId && requestedId !== req.params.id) {
      if (req.params.id === req.session.user.id) {
        return res.status(400).json({ error: 'Cannot change your own account ID while logged in' });
      }
      if (await User.exists({ _id: requestedId })) {
        return res.status(409).json({ error: 'User ID already exists' });
      }

      const originalUsername = current.username;
      const originalEmail = current.email;
      const migrationSuffix = `__migrating__${Date.now()}`;

      // Temporarily free unique keys so replacement can be created.
      await User.updateOne(
        { _id: req.params.id },
        {
          $set: {
            username: `${originalUsername}${migrationSuffix}`,
            email: `${originalEmail}${migrationSuffix}`,
          },
        }
      );

      try {
        const base = current.toObject();
        delete base._id;
        delete base.__v;

        const replacement = await User.create({
          _id: requestedId,
          ...base,
          ...updates,
          username: originalUsername,
          email: originalEmail,
        });

        await User.findByIdAndDelete(req.params.id);
        await audit(req.session.user.username, 'USER_UPDATE', req.params.id, `Updated ID: ${req.params.id} -> ${requestedId}`, replacement.siteID || replacement.site || null);
        return res.json(replacement);
      } catch (migrationErr) {
        // Roll back unique fields if migration failed.
        await User.updateOne(
          { _id: req.params.id },
          { $set: { username: originalUsername, email: originalEmail } }
        );
        throw migrationErr;
      }
    }

    const doc = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    await audit(req.session.user.username, 'USER_UPDATE', req.params.id, `Updated: ${Object.keys(req.body).filter(k => k !== 'password').join(', ')}`, doc.siteID || doc.site || null);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', adminOnly, async (req, res, next) => {
  if (req.params.id === req.session.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    const doc = await User.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await User.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'USER_DELETE', req.params.id, 'User deleted', doc.siteID || doc.site || null);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
