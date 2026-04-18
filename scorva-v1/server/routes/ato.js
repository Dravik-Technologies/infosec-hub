'use strict';

const express = require('express');
const ATO     = require('../models/ATO');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await ATO.find(req.applyTenantFilter({})).sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await ATO.findById(req.params.id);
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
      const key = String(row._id || row.id || row.system || '').trim();
      const system = String(row.system || '').trim();
      if (!key || !system) { skipped++; continue; }
      const payload = {
        _id: key,
        system,
        category: row.category || '',
        status: row.status || 'Pending Authorization',
        issued: row.issued || null,
        expires: row.expires || null,
        ao: row.ao || '',
        controls: Number(row.controls) || 0,
        open_findings: Number(row.open_findings) || 0,
        siteID,
        site: siteID,
      };
      const existing = await ATO.exists(req.applyTenantFilter({ _id: key }));
      await ATO.updateOne(req.applyTenantFilter({ _id: key }), { $set: payload }, { upsert: true });
      if (existing) updated++;
      else inserted++;
    }
    res.json({ inserted, updated, skipped });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { system, category, status, issued, expires, ao, controls, open_findings } = req.body;
  const site = req.resolveTenantSiteID(req.body);
  try {
    const last = await ATO.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('ATO-', '')) : 0;
    const id = 'ATO-' + String(lastNum + 1).padStart(3, '0');

    const doc = await ATO.create({
      _id: id, system, category, status,
      issued: issued || null, expires: expires || null, ao,
      controls: controls || 0, open_findings: open_findings || 0,
      site,
      siteID: site,
    });
    await audit(req.session.user.username, 'ATO_ADD', id, `Added: ${system}`, site);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['system','category','status','issued','expires','ao','controls','open_findings','site','siteID'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await ATO.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    const siteID = req.resolveTenantSiteID(updates);
    if (siteID) {
      updates.site = siteID;
      updates.siteID = siteID;
    }
    const updated = await ATO.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    await audit(req.session.user.username, 'ATO_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, updated.siteID || updated.site || null);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await ATO.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await ATO.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'ATO_DELETE', req.params.id, 'Deleted', doc.siteID || doc.site || null);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
