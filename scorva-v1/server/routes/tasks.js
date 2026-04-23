'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

function actor(req) {
  return req.user?.username || req.session?.user?.username || 'system';
}

function serializeTask(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    due_date: doc.dueDate ?? doc.due_date ?? null,
    linked_controls: doc.linkedControls ?? doc.linked_controls ?? [],
    activity_id: doc.activityId ?? doc.activity_id ?? null,
    source_id: doc.sourceId ?? doc.source_id ?? null,
    created_by: doc.createdBy ?? doc.created_by ?? null,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await db.task.findMany({ where: req.applyTenantFilter({}), orderBy: { id: 'desc' } });
    res.json(docs.map(serializeTask));
  } catch (err) { next(err); }
});

router.get('/mine', async (req, res, next) => {
  try {
    const username = req.user?.username || req.session?.user?.username;
    if (!username) return res.json([]);

    const userDoc     = await db.user.findUnique({ where: { username }, select: { name: true, email: true } });
    const displayName = userDoc?.name || req.user?.name || req.session?.user?.name;

    const assigneeVals = [username];
    if (displayName && displayName !== username) assigneeVals.push(displayName);
    if (userDoc?.email) assigneeVals.push(userDoc.email);

    const tasks = await db.task.findMany({
      where: req.applyTenantFilter({ assignee: { in: assigneeVals } }),
      orderBy: { id: 'desc' },
    });
    res.json(tasks.map(serializeTask));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.task.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(serializeTask(doc));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { title, type, status, priority, assignee, due_date, control,
          linked_controls, activity_id, notes } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  try {
    const last    = await db.task.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('TF-', '')) || 0 : 0;
    const id      = 'TF-' + String(lastNum + 1).padStart(4, '0');

    const doc = await db.task.create({
      data: {
        id, title, siteId,
        type: type || 'Task', status: status || 'Open', priority: priority || null,
        assignee: assignee || null, dueDate: due_date || null, control: control || null,
        notes: notes || null, linkedControls: linked_controls || [],
        activityId: activity_id || null,
        created: new Date().toISOString().split('T')[0],
        source: null, sourceId: null,
        createdBy: actor(req),
      },
    });
    await audit(actor(req), 'TASK_ADD', id, `Added: ${title}`, siteId);
    res.status(201).json(serializeTask(doc));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    title: 'title', type: 'type', status: 'status', priority: 'priority',
    assignee: 'assignee', due_date: 'dueDate', control: 'control',
    linked_controls: 'linkedControls', activity_id: 'activityId',
    evidence: 'evidence', notes: 'notes',
  };
  const data = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const doc = await db.task.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });

    const siteId = req.resolveTenantSiteId(req.body);
    if (siteId) data.siteId = siteId;

    const updated = await db.task.update({ where: { id: req.params.id }, data });

    if (data.status === 'Completed') {
      const today = new Date().toISOString().split('T')[0];
      if (doc.source === 'conmon' && doc.sourceId) {
        const cm = await db.conMon.update({
          where: { id: doc.sourceId },
          data: { status: 'Completed', completedDate: today },
        });
        if (cm?.linkedControls?.length) {
          await db.control.updateMany({
            where: { id: { in: cm.linkedControls } },
            data: { conmonStatus: 'Compliant', lastReview: today },
          });
        }
      }
      if (doc.linkedControls?.length) {
        await db.control.updateMany({
          where: { id: { in: doc.linkedControls } },
          data: { conmonStatus: 'Compliant', lastReview: today },
        });
      }
    }

    await audit(actor(req), 'TASK_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, updated.siteId);
    res.json(serializeTask(updated));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.task.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.task.delete({ where: { id: req.params.id } });
    await audit(actor(req), 'TASK_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
