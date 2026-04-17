'use strict';

const express = require('express');
const ConMon  = require('../models/ConMon');
const audit   = require('../middleware/audit');
const router  = express.Router();

/* ── GET all ── */
router.get('/', async (req, res, next) => {
  try {
    const filter = req.siteFilter ? { site: req.siteFilter } : {};
    res.json(await ConMon.find(filter));
  } catch (err) { next(err); }
});

/* ── GET one ── */
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await ConMon.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

/* ── Bulk import (must be before /:id) ── */
router.post('/bulk', async (req, res, next) => {
  const { controls = [], overwrite = false } = req.body;
  const site = req.siteFilter ?? (req.body.site || null);
  // Include site prefix in IDs so different sites can have independent ConMon records per control
  const sitePrefix = site ? site.replace(/[^A-Za-z0-9]/g, '_') + '_' : '';
  let added = 0, skipped = 0;
  try {
    for (const c of controls) {
      if (!c.control_id) continue;
      const id  = 'CM-' + sitePrefix + c.control_id.replace(/[^A-Za-z0-9\-]/g, '_');
      const doc = {
        _id:                    id,
        control_id:             c.control_id,
        control_title:          c.control_title          || '',
        family:                 c.family                 || '',
        daag_jsig_frequency:    c.daag_jsig_frequency    || '',
        baseline_applicability: c.baseline_applicability || '',
        conmon_group:           c.conmon_group            || '',
        notes:                  c.notes                  || '',
        due_date:               c.due_date               || null,
        status:                 'Pending',
        site,
      };
      if (overwrite) {
        await ConMon.updateOne({ _id: id }, { $set: doc }, { upsert: true });
        added++;
      } else {
        if (await ConMon.exists({ _id: id })) { skipped++; continue; }
        await ConMon.create(doc);
        added++;
      }
    }
    await audit(req.session.user.username, 'CONMON_BULK_IMPORT', 'bulk',
      `Bulk import: ${added} controls added, ${skipped} skipped`, site);
    res.json({ added, skipped });
  } catch (err) { next(err); }
});

/* ── POST create (manual entry) ── */
router.post('/', async (req, res, next) => {
  const {
    control_id, control_title, family,
    daag_jsig_frequency, baseline_applicability,
    conmon_group, notes, due_date,
  } = req.body;
  if (!control_id) return res.status(400).json({ error: 'control_id is required' });
  const site = req.siteFilter ?? (req.body.site || null);
  try {
    const last    = await ConMon.findOne().sort({ created_at: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace(/^CM-[^0-9]*/, '')) || 0 : 0;
    const id      = 'CM-' + String(lastNum + 1).padStart(3, '0');
    const doc = await ConMon.create({
      _id: id, control_id, control_title, family,
      daag_jsig_frequency, baseline_applicability,
      conmon_group, notes, due_date: due_date || null,
      status: 'Pending', site,
    });
    await audit(req.session.user.username, 'CONMON_ADD', id, `Added: ${control_id}`, site);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

/* ── PATCH update ── */
router.patch('/:id', async (req, res, next) => {
  const allowed = [
    'control_id', 'control_title', 'family',
    'daag_jsig_frequency', 'baseline_applicability',
    'conmon_group', 'notes', 'due_date',
    'status', 'completed_date',
  ];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });

  /* Auto-set completed_date when marking complete */
  if (updates.status === 'Completed' && !updates.completed_date) {
    updates.completed_date = new Date().toISOString().split('T')[0];
  }
  /* Clear completed_date if re-opening */
  if (updates.status === 'Pending') {
    updates.completed_date = null;
  }

  try {
    const doc = await ConMon.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });

    const updated = await ConMon.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    await audit(req.session.user.username, 'CONMON_UPDATE', req.params.id,
      `Updated: ${Object.keys(updates).join(', ')}`, doc.site);
    res.json(updated);
  } catch (err) { next(err); }
});

/* ── DELETE ── */
router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await ConMon.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    await ConMon.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'CONMON_DELETE', req.params.id, `Deleted: ${doc.control_id}`, doc.site);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
