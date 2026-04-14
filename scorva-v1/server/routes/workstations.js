'use strict';

const express     = require('express');
const Workstation = require('../models/Workstation');
const audit       = require('../middleware/audit');
const router      = express.Router();

const ALLOWED = [
  'asset_tag','hostname','type','username','site','os','ip',
  'location','classification','status','system','key_expiry',
  'last_seen','notes',
];

router.get('/', async (req, res, next) => {
  try {
    res.json(await Workstation.find().sort({ _id: 1 }));
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

    const doc = await Workstation.create({ _id: id, ...fields });
    await audit(req.session.user.username, 'WS_ADD', id, `Added: ${fields.hostname}`, fields.site);
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
    const doc = await Workstation.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'WS_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, doc.site);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Workstation.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'WS_DELETE', req.params.id, 'Deleted', doc.site);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
