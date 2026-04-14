'use strict';

const express = require('express');
const ATO     = require('../models/ATO');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await ATO.find().sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await ATO.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { system, category, status, issued, expires, ao, controls, open_findings } = req.body;
  try {
    const last = await ATO.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('ATO-', '')) : 0;
    const id = 'ATO-' + String(lastNum + 1).padStart(3, '0');

    const doc = await ATO.create({
      _id: id, system, category, status,
      issued: issued || null, expires: expires || null, ao,
      controls: controls || 0, open_findings: open_findings || 0,
    });
    await audit(req.session.user.username, 'ATO_ADD', id, `Added: ${system}`);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['system','category','status','issued','expires','ao','controls','open_findings'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await ATO.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'ATO_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await ATO.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'ATO_DELETE', req.params.id, 'Deleted');
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
