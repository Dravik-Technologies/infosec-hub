'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.license.findMany({ where: req.applyTenantFilter({}), orderBy: { id: 'asc' } }));
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const rows  = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const siteId = req.resolveTenantSiteId(req.body);
  if (!rows.length) return res.status(400).json({ error: 'rows must be a non-empty array' });

  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const row of rows) {
      const key     = String(row._id || row.id || row.product || '').trim();
      const product = String(row.product || '').trim();
      if (!key || !product) { skipped++; continue; }
      const payload = {
        id: key, product, vendor: row.vendor || '',
        seats: Number(row.seats) || 0, used: Number(row.used) || 0,
        status: row.status || 'Active',
        expires: row.expires || null, cost: row.cost || null, siteId,
      };
      const existing = await db.license.findFirst({
        where: { id: key, ...req.applyTenantFilter({}) }, select: { id: true },
      });
      await db.license.upsert({ where: { id: key }, update: payload, create: payload });
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
    const result = await db.license.deleteMany({
      where: { id: { in: ids }, ...req.applyTenantFilter({}) },
    });
    await audit(req.session.user.username, 'LICENSE_BULK_DELETE', 'bulk',
      `Deleted ${result.count} licenses`, req.tenantSiteId);
    res.json({ requested: ids.length, deletedCount: result.count });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { product, vendor, seats, used, status, expires, cost } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  try {
    const last    = await db.license.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('LIC-', '')) || 0 : 0;
    const id      = 'LIC-' + String(lastNum + 1).padStart(3, '0');

    const doc = await db.license.create({
      data: {
        id, product, vendor: vendor || null,
        seats: seats || 0, used: used || 0,
        status: status || 'Active',
        siteId: siteId || null,
        expires: expires || null, cost: cost || null,
      },
    });
    await audit(req.session.user.username, 'LICENSE_ADD', id, `Added: ${product}`, siteId);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    product: 'product', vendor: 'vendor', seats: 'seats', used: 'used',
    status: 'status', expires: 'expires', cost: 'cost',
  };
  const data = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const existing = await db.license.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const siteId = req.resolveTenantSiteId(req.body);
    if (siteId) data.siteId = siteId;
    const doc = await db.license.update({ where: { id: req.params.id }, data });
    await audit(req.session.user.username, 'LICENSE_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, doc.siteId);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.license.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.license.delete({ where: { id: req.params.id } });
    await audit(req.session.user.username, 'LICENSE_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
