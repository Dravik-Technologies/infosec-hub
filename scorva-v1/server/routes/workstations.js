'use strict';

const express     = require('express');
const Workstation = require('../models/Workstation');
const audit       = require('../middleware/audit');
const router      = express.Router();

const ALLOWED = [
  'asset_tag','hostname','type','username','site','siteID','os','ip',
  'location','classification','status','system','key_expiry',
  'last_seen','notes',
];

router.get('/', async (req, res, next) => {
  try {
    res.json(await Workstation.find(req.applyTenantFilter({})).sort({ _id: 1 }));
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
      const key = String(row._id || row.id || row.asset_tag || row.hostname || '').trim();
      if (!key) { skipped++; continue; }

      const payload = { siteID, site: siteID };
      for (const k of ALLOWED) {
        if (k in row) payload[k] = row[k];
      }
      if (!payload.hostname) payload.hostname = key;

      const existing = await Workstation.exists(req.applyTenantFilter({ _id: key }));
      await Workstation.updateOne(
        req.applyTenantFilter({ _id: key }),
        { $set: { _id: key, ...payload } },
        { upsert: true }
      );
      if (existing) updated++;
      else inserted++;
    }
    res.json({ inserted, updated, skipped });
  } catch (err) { next(err); }
});

router.post('/bulk-delete', async (req, res, next) => {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map(String).map(v => v.trim()).filter(Boolean))]
    : [];
  if (!ids.length) return res.status(400).json({ error: 'ids must be a non-empty array' });
  try {
    const result = await Workstation.deleteMany(req.applyTenantFilter({ _id: { $in: ids } }));
    await audit(req.session.user.username, 'WS_BULK_DELETE', 'bulk', `Deleted ${result.deletedCount || 0} devices`, req.tenantSiteID);
    res.json({ requested: ids.length, deletedCount: result.deletedCount || 0 });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const last    = await Workstation.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('WS-', '')) : 0;
    const id      = 'WS-' + String(lastNum + 1).padStart(4, '0');

    const fields = {};
    for (const key of ALLOWED) {
      if (key in req.body) fields[key] = req.body[key];
    }
    const siteID = req.resolveTenantSiteID(fields);
    fields.siteID = siteID;
    fields.site = siteID;

    const doc = await Workstation.create({ _id: id, ...fields });
    await audit(req.session.user.username, 'WS_ADD', id, `Added: ${fields.hostname}`, siteID);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const updates = {};
  for (const key of ALLOWED) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const existing = await Workstation.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const siteID = req.resolveTenantSiteID(updates);
    if (siteID) {
      updates.siteID = siteID;
      updates.site = siteID;
    }
    const doc = await Workstation.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'WS_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, doc.siteID || doc.site || null);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Workstation.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await Workstation.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'WS_DELETE', req.params.id, 'Deleted', doc.siteID || doc.site || null);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
