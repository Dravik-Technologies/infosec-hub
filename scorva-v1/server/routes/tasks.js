'use strict';

const express  = require('express');
const Task     = require('../models/Task');
const ConMon   = require('../models/ConMon');
const Control  = require('../models/Control');
const User     = require('../models/User');
const audit    = require('../middleware/audit');
const router   = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await Task.find(req.applyTenantFilter({})).sort({ _id: -1 }));
  } catch (err) { next(err); }
});

/* ── GET tasks assigned to the current user ── */
router.get('/mine', async (req, res, next) => {
  try {
    const username = req.session.user?.username;
    if (!username) return res.json([]);

    const userDoc     = await User.findOne({ username }).select('name');
    const sessionName = req.session.user?.name;
    const displayName = userDoc?.name || sessionName;

    const assigneeVals = [username];
    if (displayName && displayName !== username) assigneeVals.push(displayName);

    const filter = { assignee: { $in: assigneeVals } };
    const siteConstrainedFilter = req.applyTenantFilter(filter);

    const tasks = await Task.find(siteConstrainedFilter).sort({ _id: -1 });
    res.json(tasks);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Task.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { title, type, status, priority, assignee, due_date, control,
          linked_controls, activity_id, notes } = req.body;
  const site = req.resolveTenantSiteID(req.body);
  try {
    const last    = await Task.findOne().sort({ _id: -1 }).select('_id');
    const lastNum = last ? parseInt(last._id.replace('TF-', '')) || 0 : 0;
    const id      = 'TF-' + String(lastNum + 1).padStart(4, '0');

    const doc = await Task.create({
      _id: id, title, site, siteID: site,
      type: type || 'Task', status: status || 'Open', priority,
      assignee, due_date: due_date || null, control, notes: notes || null,
      linked_controls: linked_controls || [],
      activity_id: activity_id || null,
      created: new Date().toISOString().split('T')[0],
      source: null, source_id: null,
      created_by: req.session.user?.username || null,
    });
    await audit(req.session.user.username, 'TASK_ADD', id, `Added: ${title}`, site);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const allowed = ['title','site','siteID','type','status','priority','assignee','due_date',
                   'control','linked_controls','activity_id','evidence','notes'];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await Task.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    const siteID = req.resolveTenantSiteID(updates);
    if (siteID) {
      updates.site = siteID;
      updates.siteID = siteID;
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });

    /* cascade: task completed → update linked ConMon + Controls */
    if (updates.status === 'Completed') {
      const today = new Date().toISOString().split('T')[0];

      /* update linked ConMon activity */
      if (doc.source === 'conmon' && doc.source_id) {
        const cm = await ConMon.findByIdAndUpdate(
          doc.source_id,
          { $set: { status: 'Completed', completed_date: today } },
          { new: true }
        );
        /* cascade to ConMon's linked_controls */
        if (cm?.linked_controls?.length) {
          await Control.updateMany(
            { _id: { $in: cm.linked_controls } },
            { $set: { conmon_status: 'Compliant', last_review: today } }
          );
        }
      }

      /* also cascade task's own linked_controls */
      if (doc.linked_controls?.length) {
        await Control.updateMany(
          { _id: { $in: doc.linked_controls } },
          { $set: { conmon_status: 'Compliant', last_review: today } }
        );
      }
    }

    await audit(req.session.user.username, 'TASK_UPDATE', req.params.id,
      `Updated: ${Object.keys(updates).join(', ')}`, updated.site);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Task.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await Task.findByIdAndDelete(req.params.id);
    await audit(req.session.user.username, 'TASK_DELETE', req.params.id, 'Deleted', doc.siteID || doc.site || null);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
