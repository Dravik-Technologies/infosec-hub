'use strict';

const express = require('express');
const YubiKey = require('../models/YubiKey');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await YubiKey.find(req.applyTenantFilter({})).sort({ _id: 1 }));
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
      const serial = String(row.serial || '').trim();
      if (!serial) { skipped++; continue; }
      const key = String(row._id || row.id || `YK-${serial.replace(/[^A-Za-z0-9]/g, '_')}`).trim();
      const payload = {
        _id: key,
        serial,
        model: row.model || '',
        status: row.status || 'Unassigned',
        username: row.username || null,
        issued: row.issued || null,
        last_auth: row.last_auth || null,
        siteID,
        site: siteID,
      };
      const existing = await YubiKey.exists(req.applyTenantFilter({ serial }));
      await YubiKey.updateOne(req.applyTenantFilter({ serial }), { $set: payload }, { upsert: true });
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
    const result = await YubiKey.deleteMany(req.applyTenantFilter({ _id: { $in: ids } }));
    await audit(req.session.user.username, 'YUBIKEY_BULK_DELETE', 'bulk', `Deleted ${result.deletedCount || 0} yubikeys`, req.tenantSiteID);
    res.json({ requested: ids.length, deletedCount: result.deletedCount || 0 });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { serial, model, status, username, issued, last_auth } = req.body;
  const siteID = req.resolveTenantSiteID(req.body);
  try {
    const last = await YubiKey.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('YK-', '')) : 0;
    const id = 'YK-' + String(lastNum + 1).padStart(4, '0');

    const doc = await YubiKey.create({
      _id: id, serial, model,
      status: status || 'Unassigned',
      username: username || null, siteID: siteID || null, site: siteID || null,
      issued: issued || null, last_auth: last_auth || null,
    });
    await audit(req.session.user.username, 'YUBIKEY_ADD', id, `Added: ${serial}`, siteID);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['serial','model','status','username','site','siteID','issued','last_auth'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const existing = await YubiKey.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const siteID = req.resolveTenantSiteID(updates);
    if (siteID) {
      updates.siteID = siteID;
      updates.site = siteID;
    }
    const doc = await YubiKey.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'YUBIKEY_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, doc.siteID || doc.site || null);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await YubiKey.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await YubiKey.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'YUBIKEY_DELETE', req.params.id, 'Deleted', doc.siteID || doc.site || null);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
