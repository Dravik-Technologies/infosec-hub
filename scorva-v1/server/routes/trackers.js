'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const { completeTasksForSource, ensureTaskForSource } = require('../utils/taskAutomation');
const router  = express.Router();

function normalizeTrackerBody(body = {}) {
  return {
    name: body.name,
    description: body.description || null,
    category: body.category || null,
    frequency: body.frequency || null,
    owner: body.owner || null,
    nextDue: body.next_due || body.nextDue || null,
    lastCompleted: body.last_completed || body.lastCompleted || null,
    status: body.status || 'Active',
    controlId: body.control_id || body.controlId || null,
    columns: body.columns || [],
    rows: body.rows || [],
    subtrackers: body.subtrackers || [],
  };
}

function serializeTracker(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    next_due: doc.nextDue ?? doc.next_due ?? null,
    last_completed: doc.lastCompleted ?? doc.last_completed ?? null,
    control_id: doc.controlId ?? doc.control_id ?? null,
  };
}

function shouldCreateTrackerTask(doc) {
  if (!doc || doc.status === 'Completed' || doc.status === 'Inactive' || !doc.nextDue) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  const due = new Date(doc.nextDue);
  const now = new Date(todayStr);
  if (Number.isNaN(due.getTime())) return false;
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return days <= 30;
}

async function syncTrackerTask(doc, username) {
  if (!shouldCreateTrackerTask(doc)) return null;
  return ensureTaskForSource({
    source: 'tracker',
    sourceId: doc.id,
    siteId: doc.siteId,
    title: `Tracker requirement: ${doc.name}`,
    type: 'Task',
    priority: 'Medium',
    assignee: doc.owner || null,
    dueDate: doc.nextDue || null,
    control: doc.controlId || null,
    linkedControls: doc.controlId ? [doc.controlId] : [],
    notes: doc.description || null,
    username,
  });
}

router.get('/', async (req, res, next) => {
  try {
    const where = req.siteFilter ? { siteId: req.siteFilter } : {};
    const docs = await db.tracker.findMany({ where, orderBy: { createdAt: 'asc' } });
    res.json(docs.map(serializeTracker));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.tracker.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.siteId !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    res.json(serializeTracker(doc));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const siteId = req.siteFilter ?? (req.body.siteId || req.body.siteID || null);
  try {
    const payload = normalizeTrackerBody(req.body);
    const doc = await db.tracker.create({
      data: {
        ...payload,
        siteId: siteId || null,
        createdBy: req.session.user.username,
      },
    });
    await syncTrackerTask(doc, req.session.user?.username || 'system');
    await audit(req.session.user?.username || 'system', 'TRACKER_ADD', doc.id, `Added: ${doc.name}`, doc.siteId);
    res.status(201).json(serializeTracker(doc));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const ALLOWED = ['name','description','category','frequency','owner','next_due','nextDue','last_completed','lastCompleted','status','control_id','controlId','columns','rows','subtrackers'];
  const data = {};
  for (const key of ALLOWED) {
    if (key in req.body) data[key] = req.body[key];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });
  try {
    const doc = await db.tracker.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.siteId !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    const normalized = normalizeTrackerBody({ ...doc, ...req.body });
    if (req.siteFilter) normalized.siteId = req.siteFilter;
    const updated = await db.tracker.update({ where: { id: req.params.id }, data: normalized });
    if (updated.status === 'Completed') {
      await completeTasksForSource('tracker', updated.id, `Tracker completed: ${updated.name}`);
    } else {
      await syncTrackerTask(updated, req.session.user?.username || 'system');
    }
    await audit(req.session.user?.username || 'system', 'TRACKER_UPDATE', updated.id, `Updated: ${updated.name}`, updated.siteId);
    res.json(serializeTracker(updated));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.tracker.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.siteFilter && doc.siteId !== req.siteFilter) return res.status(403).json({ error: 'Forbidden' });
    await db.tracker.delete({ where: { id: req.params.id } });
    await audit(req.session.user?.username || 'system', 'TRACKER_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
