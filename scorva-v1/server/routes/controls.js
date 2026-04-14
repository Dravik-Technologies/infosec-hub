'use strict';

const express  = require('express');
const Control  = require('../models/Control');
const ConMon   = require('../models/ConMon');
const Task     = require('../models/Task');
const audit    = require('../middleware/audit');
const router   = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Control.find());
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Control.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
});

/* ── Bulk import ── must be before /:id routes ── */
router.post('/bulk', async (req, res, next) => {
  const { controls, overwrite = false } = req.body;
  if (!Array.isArray(controls) || !controls.length) {
    return res.status(400).json({ error: 'controls must be a non-empty array' });
  }

  const docs = controls.map(c => ({
    _id:                     String(c.id || '').trim(),
    title:                   c.title || '',
    family:                  c.family || '',
    status:                  c.status || 'Not Implemented',
    baseline:                c.baseline || null,
    last_review:             c.last_review || null,
    findings:                Number(c.findings) || 0,
    notes:                   c.notes || null,
    description:             c.description || null,
    implementation_guidance: c.implementation_guidance || null,
    conmon_status:           c.conmon_status || 'Open',
    conmon_group:            c.conmon_group  || null,
    conmon_frequency:        c.conmon_frequency || null,
  })).filter(d => d._id && d.title);

  if (!docs.length) {
    return res.status(400).json({ error: 'No valid controls (each needs an id and title)' });
  }

  let inserted = 0, skipped = 0, overwritten = 0;
  const errors = [];

  try {
    if (overwrite) {
      const ops = docs.map(d => ({
        updateOne: { filter: { _id: d._id }, update: { $set: d }, upsert: true },
      }));
      const r = await Control.bulkWrite(ops, { ordered: false });
      overwritten = (r.upsertedCount || 0) + (r.modifiedCount || 0);
    } else {
      try {
        const r = await Control.insertMany(docs, { ordered: false });
        inserted = r.length;
      } catch (bulkErr) {
        inserted = bulkErr.result?.insertedCount ?? 0;
        const writeErrors = bulkErr.writeErrors ?? [];
        for (const we of writeErrors) {
          if (we.code === 11000) skipped++;
          else errors.push({ id: docs[we.index]?._id ?? '?', reason: we.errmsg ?? 'Unknown error' });
        }
      }
    }
  } catch (err) { return next(err); }

  await audit(
    req.session.user.username, 'CONTROLS_BULK_IMPORT', 'bulk',
    `Bulk import: ${overwrite ? overwritten : inserted} added, ${skipped} skipped`
  );

  res.json({ inserted: overwrite ? 0 : inserted, overwritten: overwrite ? overwritten : 0, skipped, errors: errors.slice(0, 20) });
});

router.post('/', async (req, res, next) => {
  const { id, title, family, status, baseline, last_review, findings, notes,
          description, implementation_guidance,
          conmon_status, conmon_group, conmon_frequency } = req.body;
  try {
    const doc = await Control.create({
      _id: id, title, family,
      status: status || 'Not Implemented',
      baseline, last_review: last_review || null,
      findings: findings || 0, notes: notes || null,
      description: description || null,
      implementation_guidance: implementation_guidance || null,
      conmon_status: conmon_status || 'Open',
      conmon_group:  conmon_group  || null,
      conmon_frequency: conmon_frequency || null,
    });
    await audit(req.session.user.username, 'CONTROL_ADD', id, `Added: ${title}`);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['title','family','status','baseline','last_review','findings','notes',
                   'description','implementation_guidance',
                   'conmon_status','conmon_group','conmon_frequency'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await Control.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    /* reverse cascade: if conmon_status → Compliant, auto-complete any fully-compliant ConMon activities */
    if (updates.conmon_status === 'Compliant') {
      const today = new Date().toISOString().split('T')[0];
      const cms = await ConMon.find({ linked_controls: req.params.id, status: { $ne: 'Completed' } });
      for (const cm of cms) {
        if (!cm.linked_controls?.length) continue;
        const compliantN = await Control.countDocuments({
          _id: { $in: cm.linked_controls }, conmon_status: 'Compliant',
        });
        if (compliantN >= cm.linked_controls.length) {
          await ConMon.findByIdAndUpdate(cm._id, { $set: { status: 'Completed', completed_date: today } });
          await Task.updateOne({ source: 'conmon', source_id: cm._id }, { $set: { status: 'Completed' } });
        }
      }
    }

    await audit(req.session.user.username, 'CONTROL_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`);
    res.json(doc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Control.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    await audit(req.session.user.username, 'CONTROL_DELETE', req.params.id, 'Deleted');
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
