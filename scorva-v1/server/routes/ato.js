'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

function actor(req) {
  return req.user?.username || req.session?.user?.username || 'system';
}

function serializeAto(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    open_findings: doc.openFindings ?? doc.open_findings ?? 0,
    site_id: doc.siteId ?? doc.site_id ?? null,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await db.atoPackage.findMany({ where: req.applyTenantFilter({}), orderBy: { id: 'asc' } });
    res.json(docs.map(serializeAto));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.atoPackage.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(serializeAto(doc));
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const rows  = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const siteId = req.resolveTenantSiteId(req.body);
  if (!rows.length) return res.status(400).json({ error: 'rows must be a non-empty array' });

  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const row of rows) {
      const key    = String(row._id || row.id || row.system || '').trim();
      const system = String(row.system || '').trim();
      if (!key || !system) { skipped++; continue; }
      const payload = {
        id: key, system, category: row.category || '',
        status: row.status || 'Pending Authorization',
        issued: row.issued || null, expires: row.expires || null,
        ao: row.ao || '', controls: Number(row.controls) || 0,
        openFindings: Number(row.open_findings) || 0, siteId,
      };
      const existing = await db.atoPackage.findFirst({
        where: { id: key, ...req.applyTenantFilter({}) }, select: { id: true },
      });
      await db.atoPackage.upsert({ where: { id: key }, update: payload, create: payload });
      if (existing) updated++; else inserted++;
    }
    res.json({ inserted, updated, skipped });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { system, category, status, issued, expires, ao, controls, open_findings } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  try {
    const last    = await db.atoPackage.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('ATO-', '')) || 0 : 0;
    const id      = 'ATO-' + String(lastNum + 1).padStart(3, '0');

    const doc = await db.atoPackage.create({
      data: {
        id, system, category, status,
        issued: issued || null, expires: expires || null, ao,
        controls: controls || 0, openFindings: open_findings || 0, siteId,
      },
    });
    await audit(actor(req), 'ATO_ADD', id, `Added: ${system}`, siteId);
    res.status(201).json(serializeAto(doc));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    system: 'system', category: 'category', status: 'status',
    issued: 'issued', expires: 'expires', ao: 'ao',
    controls: 'controls', open_findings: 'openFindings', openFindings: 'openFindings',
  };
  const data = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await db.atoPackage.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    const siteId = req.resolveTenantSiteId(req.body);
    if (siteId) data.siteId = siteId;
    const updated = await db.atoPackage.update({ where: { id: req.params.id }, data });
    await audit(actor(req), 'ATO_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, updated.siteId);
    res.json(serializeAto(updated));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.atoPackage.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.atoPackage.delete({ where: { id: req.params.id } });
    await audit(actor(req), 'ATO_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
