'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

function adminOnly(req, res, next) {
  if ((req.user?.role || req.session?.user?.role) !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function normalizeSites(payload) {
  const from = []
    .concat(payload.siteIds  || [])
    .concat(payload.siteIDs  || [])
    .concat(payload.sites    || []);
  const scalar = payload.siteId || payload.siteID || payload.site || null;
  const merged = [...from, scalar].filter(Boolean).map(v => String(v).trim()).filter(Boolean);
  return [...new Set(merged)];
}

function pickFirstDefined(...values) {
  return values.find(v => v !== undefined);
}

function coerceBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'object') {
    if ('checked' in value) return coerceBoolean(value.checked, fallback);
    if ('value' in value) return coerceBoolean(value.value, fallback);
  }
  return fallback;
}

function normalizeUserPayload(payload) {
  return {
    trainingCompliant: coerceBoolean(
      pickFirstDefined(payload.training_compliant, payload.trainingCompliant),
      false
    ),
    trainingDue: pickFirstDefined(payload.training_due, payload.trainingDue) || null,
    dod8140: pickFirstDefined(payload.dod_8140, payload.dod8140) ?? null,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const where = req.applyTenantFilter({});
    res.json(await db.user.findMany({ where, orderBy: { id: 'asc' } }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.user.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', adminOnly, async (req, res, next) => {
  const { id, name, title, username, email, password, role, status } = req.body;
  const manualId = (id || '').trim();
  const siteIds  = normalizeSites(req.body);
  const siteId   = siteIds[0] || null;
  const { trainingCompliant, trainingDue, dod8140 } = normalizeUserPayload(req.body);

  if (!manualId) return res.status(400).json({ error: 'id is required' });
  if (!password) return res.status(400).json({ error: 'password is required' });

  try {
    const exists = await db.user.findUnique({ where: { id: manualId }, select: { id: true } });
    if (exists) return res.status(409).json({ error: 'User ID already exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const doc = await db.user.create({
      data: {
        id: manualId, name, title,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash, role: role || 'Viewer',
        siteId, siteIds, status: status || 'Active',
        trainingCompliant,
        trainingDue,
        dod8140,
      },
    });
    await audit(req.session.user.username, 'USER_CREATE', manualId, `Created user: ${username}`, siteId);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', adminOnly, async (req, res, next) => {
  const ALLOWED = ['name','title','email','role','status','yubikey','workstation',
                   'training_compliant','training_due','dod_8140',
                   'trainingCompliant','trainingDue','dod8140'];
  const data = {};
  for (const key of ALLOWED) {
    if (key in req.body) {
      const prismaKey = key.replace(/_(\w)/g, (_, c) => c.toUpperCase());
      data[prismaKey] = req.body[key];
    }
  }
  if ('training_compliant' in req.body || 'trainingCompliant' in req.body) {
    data.trainingCompliant = normalizeUserPayload(req.body).trainingCompliant;
  }
  if ('training_due' in req.body || 'trainingDue' in req.body) {
    data.trainingDue = normalizeUserPayload(req.body).trainingDue;
  }
  if ('dod_8140' in req.body || 'dod8140' in req.body) {
    data.dod8140 = normalizeUserPayload(req.body).dod8140;
  }
  if (req.body.password) {
    data.passwordHash = await bcrypt.hash(req.body.password, 12);
  }

  const siteIds = normalizeSites(req.body);
  if (siteIds.length || 'siteId' in req.body || 'siteID' in req.body ||
      'site' in req.body || 'siteIds' in req.body || 'siteIDs' in req.body ||
      'sites' in req.body) {
    data.siteIds = siteIds;
    data.siteId  = siteIds[0] || null;
  }

  const requestedId = (req.body.id || '').trim();

  if (!Object.keys(data).length && !requestedId) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const current = await db.user.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Not found' });

    if (requestedId && requestedId !== req.params.id) {
      if (req.params.id === req.session.user.id) {
        return res.status(400).json({ error: 'Cannot change your own account ID while logged in' });
      }
      const idExists = await db.user.findUnique({ where: { id: requestedId }, select: { id: true } });
      if (idExists) return res.status(409).json({ error: 'User ID already exists' });

      const suffix = `__migrating__${Date.now()}`;
      await db.user.update({ where: { id: req.params.id }, data: {
        username: `${current.username}${suffix}`,
        email:    `${current.email}${suffix}`,
      }});

      try {
        const { id: _id, ...rest } = current;
        const replacement = await db.user.create({ data: { ...rest, ...data, id: requestedId,
          username: current.username, email: current.email } });
        await db.user.delete({ where: { id: req.params.id } });
        await audit(req.session.user.username, 'USER_UPDATE', req.params.id,
          `Updated ID: ${req.params.id} -> ${requestedId}`, replacement.siteId);
        return res.json(replacement);
      } catch (migErr) {
        await db.user.update({ where: { id: req.params.id }, data: {
          username: current.username, email: current.email } });
        throw migErr;
      }
    }

    const doc = await db.user.update({ where: { id: req.params.id }, data });
    await audit(req.session.user.username, 'USER_UPDATE', req.params.id,
      `Updated: ${Object.keys(req.body).filter(k => k !== 'password').join(', ')}`, doc.siteId);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', adminOnly, async (req, res, next) => {
  if (req.params.id === req.session.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    const doc = await db.user.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.user.delete({ where: { id: req.params.id } });
    await audit(req.session.user.username, 'USER_DELETE', req.params.id, 'User deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
