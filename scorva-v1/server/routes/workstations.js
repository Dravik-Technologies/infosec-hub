'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

const FIELD_MAP = {
  asset_tag: 'assetTag', hostname: 'hostname', type: 'type', username: 'username',
  os: 'os', ip: 'ip', location: 'location', classification: 'classification',
  status: 'status', system: 'system', key_expiry: 'keyExpiry', last_seen: 'lastSeen', notes: 'notes',
};

function mapFields(src) {
  const out = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in src) out[pk] = src[k];
  }
  return out;
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.workstation.findMany({ where: req.applyTenantFilter({}), orderBy: { id: 'asc' } }));
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const rows  = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const siteId = req.resolveTenantSiteId(req.body);
  if (!rows.length) return res.status(400).json({ error: 'rows must be a non-empty array' });

  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const row of rows) {
      const key = String(row._id || row.id || row.asset_tag || row.hostname || '').trim();
      if (!key) { skipped++; continue; }
      const fields = { ...mapFields(row), siteId };
      if (!fields.hostname) fields.hostname = key;
      const existing = await db.workstation.findFirst({
        where: { id: key, ...req.applyTenantFilter({}) }, select: { id: true },
      });
      await db.workstation.upsert({
        where: { id: key },
        update: fields,
        create: { id: key, ...fields },
      });
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
    const result = await db.workstation.deleteMany({
      where: { id: { in: ids }, ...req.applyTenantFilter({}) },
    });
    await audit(req.session.user.username, 'WS_BULK_DELETE', 'bulk',
      `Deleted ${result.count} devices`, req.tenantSiteId);
    res.json({ requested: ids.length, deletedCount: result.count });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const last    = await db.workstation.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('WS-', '')) || 0 : 0;
    const id      = 'WS-' + String(lastNum + 1).padStart(4, '0');

    const fields = mapFields(req.body);
    fields.siteId = req.resolveTenantSiteId(req.body);

    const doc = await db.workstation.create({ data: { id, ...fields } });
    await audit(req.session.user.username, 'WS_ADD', id, `Added: ${fields.hostname}`, fields.siteId);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const data = mapFields(req.body);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const existing = await db.workstation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const siteId = req.resolveTenantSiteId(req.body);
    if (siteId) data.siteId = siteId;
    const doc = await db.workstation.update({ where: { id: req.params.id }, data });
    await audit(req.session.user.username, 'WS_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, doc.siteId);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.workstation.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.workstation.delete({ where: { id: req.params.id } });
    await audit(req.session.user.username, 'WS_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
