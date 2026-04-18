'use strict';

const express      = require('express');
const Notification = require('../models/Notification');
const router       = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Notification.find(req.applyTenantFilter({})).sort({ created_at: -1 }));
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const existing = await Notification.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });
    const doc = await Notification.findByIdAndUpdate(req.params.id, { $set: { read: true } }, { new: true });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(req.applyTenantFilter({}), { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { type, title, message } = req.body;
  const siteID = req.resolveTenantSiteID(req.body);
  try {
    const last = await Notification.findOne().sort({ created_at: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('N-', '')) || 0 : 0;
    const id = 'N-' + String(lastNum + 1).padStart(3, '0');

    const doc = await Notification.create({
      _id: id, type: type || 'info', title, message, siteID: siteID || null, site: siteID || null,
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Notification.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
