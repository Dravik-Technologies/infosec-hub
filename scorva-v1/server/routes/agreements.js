'use strict';

const express    = require('express');
const Agreement  = require('../models/Agreement');
const audit      = require('../middleware/audit');
const router     = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Agreement.find().sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { title, category, type, status, signed, expires, parties, assigned_to, site, notes } = req.body;
  try {
    const last = await Agreement.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('AGR-', '')) : 0;
    const id = 'AGR-' + String(lastNum + 1).padStart(3, '0');

    const doc = await Agreement.create({
      _id: id, title, category: category || 'Agreement', type,
      status: status || 'Active',
      signed: signed || null, expires: expires || null,
      parties, assigned_to: assigned_to || null, site, notes: notes || null,
    });
    await audit(req.session.user.username, 'AGREEMENT_ADD', id, `Added: ${title}`, site);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['title','category','type','status','signed','expires','parties','assigned_to','site','notes'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await Agreement.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'AGREEMENT_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, doc.site);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Agreement.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'AGREEMENT_DELETE', req.params.id, 'Deleted', doc.site);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
