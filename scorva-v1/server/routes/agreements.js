'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.agreement.findMany({ where: req.applyTenantFilter({}), orderBy: { id: 'asc' } }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.agreement.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const rows  = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const siteId = req.resolveTenantSiteId(req.body);
  if (!rows.length) return res.status(400).json({ error: 'rows must be a non-empty array' });

  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const row of rows) {
      const key   = String(row._id || row.id || row.title || '').trim();
      const title = String(row.title || '').trim();
      const type  = String(row.type || '').trim();
      if (!key || !title || !type) { skipped++; continue; }
      const payload = {
        id: key, title, category: row.category || 'Agreement', type,
        status: row.status || 'Active',
        signed: row.signed || null, expires: row.expires || null,
        parties: row.parties || '', assignedTo: row.assigned_to || null,
        notes: row.notes || null, siteId,
      };
      const existing = await db.agreement.findFirst({
        where: { id: key, ...req.applyTenantFilter({}) }, select: { id: true },
      });
      await db.agreement.upsert({ where: { id: key }, update: payload, create: payload });
      if (existing) updated++; else inserted++;
    }
    res.json({ inserted, updated, skipped });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { title, category, type, status, signed, expires, parties, assigned_to, notes } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  try {
    const last    = await db.agreement.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('AGR-', '')) || 0 : 0;
    const id      = 'AGR-' + String(lastNum + 1).padStart(3, '0');

    const doc = await db.agreement.create({
      data: {
        id, title, category: category || 'Agreement', type,
        status: status || 'Active',
        signed: signed || null, expires: expires || null,
        parties: parties || null, assignedTo: assigned_to || null,
        siteId, notes: notes || null,
      },
    });
    await audit(req.session.user.username, 'AGREEMENT_ADD', id, `Added: ${title}`, siteId);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    title: 'title', category: 'category', type: 'type', status: 'status',
    signed: 'signed', expires: 'expires', parties: 'parties',
    assigned_to: 'assignedTo', notes: 'notes',
  };
  const data = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await db.agreement.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    const siteId = req.resolveTenantSiteId(req.body);
    if (siteId) data.siteId = siteId;
    const updated = await db.agreement.update({ where: { id: req.params.id }, data });
    await audit(req.session.user.username, 'AGREEMENT_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, updated.siteId);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.agreement.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.agreement.delete({ where: { id: req.params.id } });
    await audit(req.session.user.username, 'AGREEMENT_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
