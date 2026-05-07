'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

function serializeYubiKey(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    last_auth: doc.lastAuth ?? doc.last_auth ?? null,
    lost_destroyed_date: doc.lostDestroyedDate ?? doc.lost_destroyed_date ?? null,
    site_id: doc.siteId ?? doc.site_id ?? null,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await db.yubiKey.findMany({ where: req.applyTenantFilter({}), orderBy: { id: 'asc' } });
    res.json(docs.map(serializeYubiKey));
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const rows  = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const siteId = req.resolveTenantSiteId(req.body);
  if (!rows.length) return res.status(400).json({ error: 'rows must be a non-empty array' });

  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const row of rows) {
      const serial = String(row.serial || '').trim();
      if (!serial) { skipped++; continue; }
      const key = String(row._id || row.id || `YK-${serial.replace(/[^A-Za-z0-9]/g, '_')}`).trim();
      const payload = {
        id: key, serial, model: row.model || '',
        status: row.status || 'Unassigned',
        username: row.username || null,
        issued: row.issued || null, lastAuth: row.last_auth || null, siteId,
        lostDestroyedDate: row.lost_destroyed_date || row.lostDestroyedDate || null,
      };
      const existing = await db.yubiKey.findFirst({
        where: { serial, ...req.applyTenantFilter({}) }, select: { id: true },
      });
      await db.yubiKey.upsert({ where: { serial }, update: payload, create: payload });
      if (existing) updated++; else inserted++;
    }
    res.json({ inserted, updated, skipped });
  } catch (err) { next(err); }
});

router.post('/bulk-delete', async (req, res, next) => {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map(String).map(v => v.trim()).filter(Boolean))] : [];
  if (!ids.length) return res.status(400).json({ error: 'ids must be a non-empty array' });
  try {
    const result = await db.yubiKey.deleteMany({
      where: { id: { in: ids }, ...req.applyTenantFilter({}) },
    });
    await audit(req.session.user.username, 'YUBIKEY_BULK_DELETE', 'bulk',
      `Deleted ${result.count} yubikeys`, req.tenantSiteId);
    res.json({ requested: ids.length, deletedCount: result.count });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { serial, model, status, username, issued, last_auth, lost_destroyed_date, lostDestroyedDate } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  try {
    const last    = await db.yubiKey.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('YK-', '')) || 0 : 0;
    const id      = 'YK-' + String(lastNum + 1).padStart(4, '0');

    const doc = await db.yubiKey.create({
      data: {
        id, serial, model: model || null,
        status: status || 'Unassigned',
        username: username || null, siteId: siteId || null,
        issued: issued || null, lastAuth: last_auth || null,
        lostDestroyedDate: lost_destroyed_date || lostDestroyedDate || null,
      },
    });
    await audit(req.session.user.username, 'YUBIKEY_ADD', id, `Added: ${serial}`, siteId);
    res.status(201).json(serializeYubiKey(doc));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    serial: 'serial', model: 'model', status: 'status',
    username: 'username', issued: 'issued', last_auth: 'lastAuth',
    lost_destroyed_date: 'lostDestroyedDate', lostDestroyedDate: 'lostDestroyedDate',
  };
  const data = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const existing = await db.yubiKey.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const siteId = req.resolveTenantSiteId(req.body);
    if (siteId) data.siteId = siteId;
    const doc = await db.yubiKey.update({ where: { id: req.params.id }, data });
    await audit(req.session.user.username, 'YUBIKEY_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, doc.siteId);
    res.json(serializeYubiKey(doc));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.yubiKey.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.yubiKey.delete({ where: { id: req.params.id } });
    await audit(req.session.user.username, 'YUBIKEY_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
