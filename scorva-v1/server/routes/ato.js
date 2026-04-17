'use strict';

const express = require('express');
const ATO     = require('../models/ATO');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const filter = req.siteFilter ? { site: req.siteFilter } : {};
    res.json(await ATO.find(filter).sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await ATO.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { system, category, status, issued, expires, ao, controls, open_findings } = req.body;
  // Non-admin users are pinned to their site; admins may pass site in body or use their selected site
  const site = req.siteFilter ?? (req.body.site || null);
  try {
    const last = await ATO.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('ATO-', '')) : 0;
    const id = 'ATO-' + String(lastNum + 1).padStart(3, '0');

    const doc = await ATO.create({
      _id: id, system, category, status,
      issued: issued || null, expires: expires || null, ao,
      controls: controls || 0, open_findings: open_findings || 0,
      site,
    });
    await audit(req.session.user.username, 'ATO_ADD', id, `Added: ${system}`, site);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['system','category','status','issued','expires','ao','controls','open_findings','site'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await ATO.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    // Site-scoped users cannot reassign to a different site
    if (req.siteFilter) updates.site = req.siteFilter;
    const updated = await ATO.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    await audit(req.session.user.username, 'ATO_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, updated.site);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await ATO.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    await ATO.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'ATO_DELETE', req.params.id, 'Deleted', doc.site);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
