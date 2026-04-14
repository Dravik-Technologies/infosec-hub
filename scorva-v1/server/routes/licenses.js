'use strict';

const express  = require('express');
const License  = require('../models/License');
const audit    = require('../middleware/audit');
const router   = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await License.find().sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { product, vendor, seats, used, status, expires, cost } = req.body;
  try {
    const last = await License.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('LIC-', '')) : 0;
    const id = 'LIC-' + String(lastNum + 1).padStart(3, '0');

    const doc = await License.create({
      _id: id, product, vendor,
      seats: seats || 0, used: used || 0,
      status: status || 'Active',
      expires: expires || null, cost: cost || null,
    });
    await audit(req.session.user.username, 'LICENSE_ADD', id, `Added: ${product}`);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['product','vendor','seats','used','status','expires','cost'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await License.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'LICENSE_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await License.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'LICENSE_DELETE', req.params.id, 'Deleted');
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
