'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const audit   = require('../middleware/audit');
const router  = express.Router();

function adminOnly(req, res, next) {
  if (req.session.user.role !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await User.find().sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await User.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', adminOnly, async (req, res, next) => {
  const { name, title, username, email, password, role, site, status, training_compliant, training_due, dod_8140 } = req.body;
  if (!password) return res.status(400).json({ error: 'password is required' });
  try {
    const last = await User.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('USR-', '')) : 0;
    const id = 'USR-' + String(lastNum + 1).padStart(3, '0');
    const hash = await bcrypt.hash(password, 12);

    const doc = await User.create({
      _id: id, name, title,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password_hash: hash,
      role: role || 'Viewer',
      site, status: status || 'Active',
      training_compliant: training_compliant || false,
      training_due: training_due || '',
      dod_8140: dod_8140 || undefined,
    });
    await audit(req.session.user.username, 'USER_CREATE', id, `Created user: ${username}`);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', adminOnly, async (req, res, next) => {
  const allowed = ['name','title','email','role','site','status','yubikey','workstation','training_compliant','training_due','dod_8140'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (req.body.password) {
    updates.password_hash = await bcrypt.hash(req.body.password, 12);
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'USER_UPDATE', req.params.id, `Updated: ${Object.keys(req.body).filter(k => k !== 'password').join(', ')}`);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', adminOnly, async (req, res, next) => {
  if (req.params.id === req.session.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    const doc = await User.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'USER_DELETE', req.params.id, 'User deleted');
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
