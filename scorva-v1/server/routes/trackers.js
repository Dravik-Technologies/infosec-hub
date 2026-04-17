'use strict';

const express = require('express');
const Tracker = require('../models/Tracker');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const filter = req.siteFilter ? { site: req.siteFilter } : {};
    res.json(await Tracker.find(filter).sort({ created_at: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Tracker.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { name, description, columns, rows: dataRows, subtrackers } = req.body;
  const site = req.siteFilter ?? (req.body.site || null);
  try {
    const doc = await Tracker.create({
      name, description: description || null,
      columns: columns || [], rows: dataRows || [],
      subtrackers: subtrackers || [],
      site, created_by: req.session.user.username,
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['name','description','columns','rows','subtrackers','site'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await Tracker.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    if (req.siteFilter) updates.site = req.siteFilter;
    const updated = await Tracker.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Tracker.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    await Tracker.findByIdAndDelete(req.params.id);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
