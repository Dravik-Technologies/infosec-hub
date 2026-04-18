'use strict';

const express  = require('express');
const License  = require('../models/License');
const audit    = require('../middleware/audit');
const router   = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await License.find(req.applyTenantFilter({})).sort({ _id: 1 }));
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
      const key = String(row._id || row.id || row.product || '').trim();
      if (!key) { skipped++; continue; }

      const payload = {
        _id: key,
        product: row.product || '',
        vendor: row.vendor || '',
        seats: Number(row.seats) || 0,
        used: Number(row.used) || 0,
        status: row.status || 'Active',
        expires: row.expires || null,
        cost: row.cost || null,
        siteID,
        site: siteID,
      };
      if (!payload.product) { skipped++; continue; }

      const existing = await License.exists(req.applyTenantFilter({ _id: key }));
      await License.updateOne(req.applyTenantFilter({ _id: key }), { $set: payload }, { upsert: true });
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
    const result = await License.deleteMany(req.applyTenantFilter({ _id: { $in: ids } }));
    await audit(req.session.user.username, 'LICENSE_BULK_DELETE', 'bulk', `Deleted ${result.deletedCount || 0} licenses`, req.tenantSiteID);
    res.json({ requested: ids.length, deletedCount: result.deletedCount || 0 });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { product, vendor, seats, used, status, expires, cost } = req.body;
  const siteID = req.resolveTenantSiteID(req.body);
  try {
    const last = await License.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('LIC-', '')) : 0;
    const id = 'LIC-' + String(lastNum + 1).padStart(3, '0');

    const doc = await License.create({
      _id: id, product, vendor,
      seats: seats || 0, used: used || 0,
      status: status || 'Active',
      siteID: siteID || null,
      site: siteID || null,
      expires: expires || null, cost: cost || null,
    });
    await audit(req.session.user.username, 'LICENSE_ADD', id, `Added: ${product}`, siteID);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['product','vendor','seats','used','status','expires','cost','site','siteID'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const existing = await License.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const siteID = req.resolveTenantSiteID(updates);
    if (siteID) {
      updates.siteID = siteID;
      updates.site = siteID;
    }
    const doc = await License.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'LICENSE_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, doc.siteID || doc.site || null);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await License.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await License.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'LICENSE_DELETE', req.params.id, 'Deleted', doc.siteID || doc.site || null);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
