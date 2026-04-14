'use strict';

const express = require('express');
const Site    = require('../models/Site');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Site.find().sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { id, label } = req.body;
  try {
    const doc = await Site.create({ _id: id, label });
    await audit(req.session.user.username, 'SITE_ADD', id, `Added site: ${label}`);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await Site.findByIdAndUpdate(req.params.id, { $set: { label } }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'SITE_UPDATE', req.params.id, `Updated: ${label}`);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Site.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'SITE_DELETE', req.params.id, 'Deleted');
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
