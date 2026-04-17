'use strict';

const express = require('express');
const POAM    = require('../models/POAM');
const Task    = require('../models/Task');
const audit   = require('../middleware/audit');
const router  = express.Router();

const POAM_STATUS_TO_TASK = {
  'Open':        'Open',
  'In Progress': 'In Progress',
  'Completed':   'Completed',
  'Closed':      'Completed',
};

async function createLinkedTask(poamId, title, site, responsible_party, scheduled_completion, severity, username) {
  try {
    const lastTask = await Task.findOne().sort({ _id: -1 }).select('_id');
    const lastTNum = lastTask ? parseInt(lastTask._id.replace('TF-', '')) || 0 : 0;
    const taskId   = 'TF-' + String(lastTNum + 1).padStart(4, '0');
    await Task.create({
      _id: taskId, title, site,
      type: 'Finding', status: 'Open',
      priority: severity === 'Critical' ? 'Critical' : severity === 'High' ? 'High' : 'Medium',
      assignee: responsible_party || null,
      due_date: scheduled_completion || null,
      notes: null,
      created: new Date().toISOString().split('T')[0],
      source: 'poam', source_id: poamId,
      created_by: username || null,
    });
  } catch (err) {
    console.error('[SCORVA] POAM task auto-create failed for', poamId, ':', err.message);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const filter = req.siteFilter ? { site: req.siteFilter } : {};
    res.json(await POAM.find(filter).sort({ _id: 1 }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await POAM.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

/* ── Backfill missing tasks for existing POAMs ── */
router.post('/backfill-tasks', async (req, res, next) => {
  try {
    const filter = req.siteFilter ? { site: req.siteFilter } : {};
    const poams = await POAM.find(filter);
    let created = 0, skipped = 0;
    for (const p of poams) {
      const exists = await Task.exists({ source: 'poam', source_id: p._id });
      if (exists) { skipped++; continue; }
      await createLinkedTask(p._id, p.title, p.site, p.responsible_party,
        p.scheduled_completion, p.severity, req.session.user?.username);
      created++;
    }
    res.json({ created, skipped });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { title, control_id, weakness, severity, status, source_type, source_id,
          responsible_party, point_of_contact, resources, scheduled_completion, milestones,
          identified_date, ato_id, poam_type, comments } = req.body;
  const site = req.siteFilter ?? (req.body.site || null);
  try {
    const last = await POAM.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('POA-', '')) : 0;
    const id = 'POA-' + String(lastNum + 1).padStart(3, '0');

    const doc = await POAM.create({
      _id: id, title, control_id: control_id || null, weakness, severity,
      status: status || 'Open', site, source_type, source_id, responsible_party,
      point_of_contact, resources, scheduled_completion: scheduled_completion || null,
      milestones: milestones || [], identified_date: identified_date || null,
      ato_id: ato_id || null, poam_type, comments,
    });

    await createLinkedTask(id, title, site, responsible_party, scheduled_completion,
      severity, req.session.user?.username);

    await audit(req.session.user.username, 'POAM_ADD', id, `Added: ${title}`, site);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['title','control_id','weakness','severity','status','site','responsible_party',
                   'point_of_contact','resources','scheduled_completion','milestones',
                   'ato_id','poam_type','comments','completed_date','closed_date'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await POAM.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    if (req.siteFilter) updates.site = req.siteFilter;

    const updated = await POAM.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });

    /* sync linked task */
    const taskSync = {};
    if (updates.title)                               taskSync.title    = updates.title;
    if (updates.scheduled_completion !== undefined)  taskSync.due_date = updates.scheduled_completion;
    if (updates.responsible_party !== undefined)     taskSync.assignee = updates.responsible_party || null;
    if (updates.status)                              taskSync.status   = POAM_STATUS_TO_TASK[updates.status] || 'Open';
    if (updates.severity)                            taskSync.priority = updates.severity === 'Critical' ? 'Critical' : updates.severity === 'High' ? 'High' : 'Medium';
    if (Object.keys(taskSync).length) {
      await Task.updateOne({ source: 'poam', source_id: req.params.id }, { $set: taskSync });
    }

    await audit(req.session.user.username, 'POAM_UPDATE', req.params.id, `Updated: ${Object.keys(updates).join(', ')}`, updated.site);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await POAM.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.site !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    await POAM.findByIdAndDelete(req.params.id);
    await Task.deleteOne({ source: 'poam', source_id: req.params.id });
    await audit(req.session.user.username, 'POAM_DELETE', req.params.id, 'Deleted', doc.site);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
