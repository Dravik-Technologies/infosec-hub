'use strict';

const express    = require('express');
const Agreement  = require('../models/Agreement');
const audit      = require('../middleware/audit');
const router     = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Agreement.find(req.applyTenantFilter({})).sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Agreement.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const siteID = req.resolveTenantSiteID(req.body);
  if (!rows.length) return res.status(400).json({ error: 'rows must be a non-empty array' });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (const row of rows) {
      const key = String(row._id || row.id || row.title || '').trim();
      const title = String(row.title || '').trim();
      const type = String(row.type || '').trim();
      if (!key || !title || !type) { skipped++; continue; }

      const payload = {
        _id: key,
        title,
        category: row.category || 'Agreement',
        type,
        status: row.status || 'Active',
        signed: row.signed || null,
        expires: row.expires || null,
        parties: row.parties || '',
        assigned_to: row.assigned_to || null,
        notes: row.notes || null,
        siteID,
        site: siteID,
      };
      const existing = await Agreement.exists(req.applyTenantFilter({ _id: key }));
      await Agreement.updateOne(req.applyTenantFilter({ _id: key }), { $set: payload }, { upsert: true });
      if (existing) updated++;
      else inserted++;
    }
    res.json({ inserted, updated, skipped });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { title, category, type, status, signed, expires, parties, assigned_to, notes } = req.body;
  const site = req.resolveTenantSiteID(req.body);
  try {
    const last = await Agreement.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('AGR-', '')) : 0;
    const id = 'AGR-' + String(lastNum + 1).padStart(3, '0');

    const doc = await Agreement.create({
      _id: id, title, category: category || 'Agreement', type,
      status: status || 'Active',
      signed: signed || null, expires: expires || null,
      parties, assigned_to: assigned_to || null, siteID: site, site, notes: notes || null,
    });
    await audit(req.session.user.username, 'AGREEMENT_ADD', id, `Added: ${title}`, site);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['title','category','type','status','signed','expires','parties','assigned_to','site','siteID','notes'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await Agreement.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    const siteID = req.resolveTenantSiteID(updates);
    if (siteID) {
      updates.site = siteID;
      updates.siteID = siteID;
    }
    const updated = await Agreement.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    await audit(req.session.user.username, 'AGREEMENT_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, updated.siteID || updated.site || null);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Agreement.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await Agreement.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'AGREEMENT_DELETE', req.params.id, 'Deleted', doc.siteID || doc.site || null);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
