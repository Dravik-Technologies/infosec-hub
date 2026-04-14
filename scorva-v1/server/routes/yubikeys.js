'use strict';

const express = require('express');
const YubiKey = require('../models/YubiKey');
const audit   = require('../middleware/audit');
const router  = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await YubiKey.find().sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { serial, model, status, username, site, issued, last_auth } = req.body;
  try {
    const last = await YubiKey.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('YK-', '')) : 0;
    const id = 'YK-' + String(lastNum + 1).padStart(4, '0');

    const doc = await YubiKey.create({
      _id: id, serial, model,
      status: status || 'Unassigned',
      username: username || null, site: site || null,
      issued: issued || null, last_auth: last_auth || null,
    });
    await audit(req.session.user.username, 'YUBIKEY_ADD', id, `Added: ${serial}`, site);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['serial','model','status','username','site','issued','last_auth'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await YubiKey.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'YUBIKEY_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, doc.site);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await YubiKey.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'YUBIKEY_DELETE', req.params.id, 'Deleted', doc.site);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
