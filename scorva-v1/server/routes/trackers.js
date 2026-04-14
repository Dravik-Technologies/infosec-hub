'use strict';

const express = require('express');
const Tracker = require('../models/Tracker');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Tracker.find().sort({ created_at: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Tracker.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { name, description, columns, rows: dataRows, subtrackers, site } = req.body;
  try {
    const doc = await Tracker.create({
      name, description: description || null,
      columns: columns || [], rows: dataRows || [],
      subtrackers: subtrackers || [],
      site: site || null, created_by: req.session.user.username,
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
    const doc = await Tracker.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Tracker.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
