'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

const POAM_STATUS_TO_TASK = {
  'Open': 'Open', 'In Progress': 'In Progress',
  'Completed': 'Completed', 'Closed': 'Completed',
};

async function createLinkedTask(poamId, title, siteId, responsibleParty, scheduledCompletion, severity, username) {
  try {
    const last    = await db.task.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('TF-', '')) || 0 : 0;
    const taskId  = 'TF-' + String(lastNum + 1).padStart(4, '0');
    await db.task.create({
      data: {
        id: taskId, title, siteId,
        type: 'Finding', status: 'Open',
        priority: severity === 'Critical' ? 'Critical' : severity === 'High' ? 'High' : 'Medium',
        assignee: responsibleParty || null,
        dueDate: scheduledCompletion || null,
        created: new Date().toISOString().split('T')[0],
        source: 'poam', sourceId: poamId,
        createdBy: username || null,
      },
    });
  } catch (err) {
    console.error('[SCORVA] POAM task auto-create failed for', poamId, ':', err.message);
  }
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.poam.findMany({ where: req.applyTenantFilter({}), orderBy: { id: 'asc' } }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.poam.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(doc);
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const siteId = req.resolveTenantSiteId(req.body);
  if (!rows.length) return res.status(400).json({ error: 'rows must be a non-empty array' });

  let inserted = 0, updated = 0, skipped = 0;
  try {
    for (const row of rows) {
      const key   = String(row._id || row.id || '').trim();
      const title = String(row.title || '').trim();
      if (!key || !title) { skipped++; continue; }

      const payload = {
        id: key, title, controlId: row.control_id || null,
        weakness: row.weakness || '', severity: row.severity || '',
        status: row.status || 'Open', siteId,
        sourceType: row.source_type || '', sourceId: row.source_id || '',
        responsibleParty: row.responsible_party || '',
        pointOfContact: row.point_of_contact || '',
        resources: row.resources || '',
        scheduledCompletion: row.scheduled_completion || null,
        milestones: Array.isArray(row.milestones) ? row.milestones : [],
        identifiedDate: row.identified_date || null,
        atoId: row.ato_id || null, poamType: row.poam_type || '',
        comments: row.comments || '',
        completedDate: row.completed_date || null,
        closedDate: row.closed_date || null,
      };
      const existing = await db.poam.findFirst({
        where: { id: key, ...req.applyTenantFilter({}) },
        select: { id: true },
      });
      await db.poam.upsert({ where: { id: key }, update: payload, create: payload });
      if (existing) updated++; else inserted++;
    }
    res.json({ inserted, updated, skipped });
  } catch (err) { next(err); }
});

router.post('/backfill-tasks', async (req, res, next) => {
  try {
    const poams = await db.poam.findMany({ where: req.applyTenantFilter({}) });
    let created = 0, skipped = 0;
    for (const p of poams) {
      const exists = await db.task.findFirst({ where: { source: 'poam', sourceId: p.id }, select: { id: true } });
      if (exists) { skipped++; continue; }
      await createLinkedTask(p.id, p.title, p.siteId, p.responsibleParty,
        p.scheduledCompletion, p.severity, req.session.user?.username);
      created++;
    }
    res.json({ created, skipped });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { title, control_id, weakness, severity, status, source_type, source_id,
          responsible_party, point_of_contact, resources, scheduled_completion, milestones,
          identified_date, ato_id, poam_type, comments } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  try {
    const last    = await db.poam.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('POA-', '')) || 0 : 0;
    const id      = 'POA-' + String(lastNum + 1).padStart(3, '0');

    const doc = await db.poam.create({
      data: {
        id, title, controlId: control_id || null, weakness, severity,
        status: status || 'Open', siteId, sourceType: source_type, sourceId: source_id,
        responsibleParty: responsible_party, pointOfContact: point_of_contact,
        resources, scheduledCompletion: scheduled_completion || null,
        milestones: milestones || [], identifiedDate: identified_date || null,
        atoId: ato_id || null, poamType: poam_type, comments,
      },
    });

    await createLinkedTask(id, title, siteId, responsible_party, scheduled_completion,
      severity, req.session.user?.username);
    await audit(req.session.user.username, 'POAM_ADD', id, `Added: ${title}`, siteId);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    title: 'title', control_id: 'controlId', weakness: 'weakness', severity: 'severity',
    status: 'status', responsible_party: 'responsibleParty',
    point_of_contact: 'pointOfContact', resources: 'resources',
    scheduled_completion: 'scheduledCompletion', milestones: 'milestones',
    ato_id: 'atoId', poam_type: 'poamType', comments: 'comments',
    completed_date: 'completedDate', closed_date: 'closedDate',
  };
  const data = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const doc = await db.poam.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });

    const siteId = req.resolveTenantSiteId(req.body);
    if (siteId) data.siteId = siteId;

    const updated = await db.poam.update({ where: { id: req.params.id }, data });

    const taskSync = {};
    if (data.title)                taskSync.title    = data.title;
    if ('scheduledCompletion' in data) taskSync.dueDate = data.scheduledCompletion;
    if ('responsibleParty' in data)    taskSync.assignee = data.responsibleParty || null;
    if (data.status)               taskSync.status   = POAM_STATUS_TO_TASK[data.status] || 'Open';
    if (data.severity)             taskSync.priority = data.severity === 'Critical' ? 'Critical' : data.severity === 'High' ? 'High' : 'Medium';
    if (Object.keys(taskSync).length) {
      await db.task.updateMany({ where: { source: 'poam', sourceId: req.params.id }, data: taskSync });
    }

    await audit(req.session.user.username, 'POAM_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, updated.siteId);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.poam.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.poam.delete({ where: { id: req.params.id } });
    await db.task.deleteMany({ where: { source: 'poam', sourceId: req.params.id } });
    await audit(req.session.user.username, 'POAM_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
