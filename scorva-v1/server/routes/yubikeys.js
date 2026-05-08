'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

async function attachLostDestroyedDates(docs) {
  if (!docs) return docs;
  const items = Array.isArray(docs) ? docs : [docs];
  if (!items.length) return Array.isArray(docs) ? [] : docs;

  const ids = items.map(doc => doc.id).filter(Boolean);
  if (!ids.length) return docs;

  const rows = await db.$queryRawUnsafe(
    'SELECT id, lost_destroyed_date FROM yubi_keys WHERE id = ANY($1::text[])',
    ids
  );
  const byId = new Map(rows.map(row => [row.id, row.lost_destroyed_date || null]));
  const mapped = items.map(doc => ({
    ...doc,
    lostDestroyedDate: byId.get(doc.id) ?? null,
  }));

  return Array.isArray(docs) ? mapped : mapped[0];
}

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
    const docs = await attachLostDestroyedDates(
      await db.yubiKey.findMany({ where: req.applyTenantFilter({}), orderBy: { id: 'asc' } })
    );
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
      };
      const existing = await db.yubiKey.findFirst({
        where: { serial, ...req.applyTenantFilter({}) }, select: { id: true },
      });
      const doc = await db.yubiKey.upsert({ where: { serial }, update: payload, create: payload });
      if ('lost_destroyed_date' in row || 'lostDestroyedDate' in row) {
        await db.$executeRawUnsafe(
          'UPDATE yubi_keys SET lost_destroyed_date = $1 WHERE id = $2',
          row.lost_destroyed_date || row.lostDestroyedDate || null,
          doc.id
        );
      }
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
      },
    });
    await db.$executeRawUnsafe(
      'UPDATE yubi_keys SET lost_destroyed_date = $1 WHERE id = $2',
      lost_destroyed_date || lostDestroyedDate || null,
      doc.id
    );
    await audit(req.session.user.username, 'YUBIKEY_ADD', id, `Added: ${serial}`, siteId);
    res.status(201).json(serializeYubiKey(await attachLostDestroyedDates(doc)));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    serial: 'serial', model: 'model', status: 'status',
    username: 'username', issued: 'issued', last_auth: 'lastAuth',
  };
  const data = {};
  const lostDestroyedDate =
    ('lost_destroyed_date' in req.body || 'lostDestroyedDate' in req.body)
      ? (req.body.lost_destroyed_date || req.body.lostDestroyedDate || null)
      : undefined;
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length && lostDestroyedDate === undefined) return res.status(400).json({ error: 'No fields to update' });
  try {
    const existing = await db.yubiKey.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const siteId = req.resolveTenantSiteId(req.body);
    if (siteId) data.siteId = siteId;
    const doc = Object.keys(data).length
      ? await db.yubiKey.update({ where: { id: req.params.id }, data })
      : existing;
    if (lostDestroyedDate !== undefined) {
      await db.$executeRawUnsafe(
        'UPDATE yubi_keys SET lost_destroyed_date = $1 WHERE id = $2',
        lostDestroyedDate,
        req.params.id
      );
    }
    await audit(req.session.user.username, 'YUBIKEY_UPDATE', req.params.id,
      `Updated: ${[...Object.keys(data), ...(lostDestroyedDate !== undefined ? ['lost_destroyed_date'] : [])].join(', ')}`, doc.siteId);
    res.json(serializeYubiKey(await attachLostDestroyedDates(doc)));
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
