'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const router  = express.Router();

function actor(req) {
  return req.user?.username || req.session?.user?.username || 'system';
}

function serializeControl(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    last_review: doc.lastReview ?? doc.last_review ?? null,
    implementation_guidance: doc.implementationGuidance ?? doc.implementation_guidance ?? null,
    conmon_status: doc.conmonStatus ?? doc.conmon_status ?? 'Open',
    conmon_group: doc.conmonGroup ?? doc.conmon_group ?? null,
    conmon_frequency: doc.conmonFrequency ?? doc.conmon_frequency ?? null,
    site_id: doc.siteId ?? doc.site_id ?? null,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await db.control.findMany({ where: req.applyTenantFilter({}) });
    res.json(docs.map(serializeControl));
  } catch (err) { next(err); }
});

router.post('/bulk-delete', async (req, res, next) => {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map(String).map(v => v.trim()).filter(Boolean))]
    : [];
  if (!ids.length) return res.status(400).json({ error: 'ids must be a non-empty array' });

  const hasTenantScope  = Array.isArray(req.tenantSiteIds) && req.tenantSiteIds.length > 0;
  const isCorporateAdmin = req.user?.role === 'Corporate Admin';
  if (!hasTenantScope && !isCorporateAdmin) {
    return res.status(400).json({ error: 'A site context is required for bulk delete' });
  }

  const siteFilter = hasTenantScope
    ? { siteId: { in: req.tenantSiteIds } }
    : { siteId: { not: null } };

  try {
    const allowed = await db.conMon.findMany({
      where: { id: { in: ids }, ...siteFilter },
      select: { id: true },
    });
    const allowedIds = allowed.map(d => d.id);
    if (!allowedIds.length) {
      return res.json({ requested: ids.length, deletedCount: 0, ignored: ids.length });
    }

    const result = await db.conMon.deleteMany({
      where: { id: { in: allowedIds }, ...siteFilter },
    });
    await audit(req.user?.username || 'system', 'CONMON_BULK_DELETE', 'bulk',
      `Deleted ${result.count} ConMon controls in bulk`,
      req.tenantSiteId || req.user?.siteId || null);
    res.json({ requested: ids.length, deletedCount: result.count, ignored: ids.length - result.count });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.control.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    res.json(serializeControl(doc));
  } catch (err) { next(err); }
});

router.post('/bulk', async (req, res, next) => {
  const { controls, overwrite = false } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  if (!Array.isArray(controls) || !controls.length) {
    return res.status(400).json({ error: 'controls must be a non-empty array' });
  }

  const docs = controls.map(c => ({
    id:                    String(c.id || '').trim(),
    title:                 c.title || '',
    family:                c.family || '',
    status:                c.status || 'Not Implemented',
    baseline:              c.baseline || null,
    lastReview:            c.last_review || null,
    findings:              Number(c.findings) || 0,
    notes:                 c.notes || null,
    description:           c.description || null,
    implementationGuidance: c.implementation_guidance || null,
    conmonStatus:          c.conmon_status || 'Open',
    conmonGroup:           c.conmon_group  || null,
    conmonFrequency:       c.conmon_frequency || null,
    siteId,
  })).filter(d => d.id && d.title);

  if (!docs.length) {
    return res.status(400).json({ error: 'No valid controls (each needs an id and title)' });
  }

  let inserted = 0, skipped = 0, overwritten = 0;
  const errors = [];

  try {
    if (overwrite) {
      for (const d of docs) {
        await db.control.upsert({
          where: { id: d.id },
          update: d,
          create: d,
        });
        overwritten++;
      }
    } else {
      for (const d of docs) {
        try {
          await db.control.create({ data: d });
          inserted++;
        } catch (e) {
          if (e.code === 'P2002') skipped++;
          else errors.push({ id: d.id, reason: e.message });
        }
      }
    }
  } catch (err) { return next(err); }

  await audit(actor(req), 'CONTROLS_BULK_IMPORT', 'bulk',
    `Bulk import: ${overwrite ? overwritten : inserted} added, ${skipped} skipped`,
    siteId || req.tenantSiteId || null);

  res.json({ inserted: overwrite ? 0 : inserted, overwritten: overwrite ? overwritten : 0, skipped, errors: errors.slice(0, 20) });
});

router.post('/', async (req, res, next) => {
  const { id, title, family, status, baseline, last_review, findings, notes,
          description, implementation_guidance,
          conmon_status, conmon_group, conmon_frequency } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  try {
    const doc = await db.control.create({
      data: {
        id, title, family,
        status: status || 'Not Implemented',
        baseline: baseline || null,
        lastReview: last_review || null,
        findings: findings || 0,
        notes: notes || null,
        description: description || null,
        implementationGuidance: implementation_guidance || null,
        conmonStatus: conmon_status || 'Open',
        conmonGroup:  conmon_group  || null,
        conmonFrequency: conmon_frequency || null,
        siteId,
      },
    });
    await audit(actor(req), 'CONTROL_ADD', id, `Added: ${title}`, siteId);
    res.status(201).json(serializeControl(doc));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    title: 'title', family: 'family', status: 'status', baseline: 'baseline',
    last_review: 'lastReview', lastReview: 'lastReview', findings: 'findings', notes: 'notes',
    description: 'description', implementation_guidance: 'implementationGuidance', implementationGuidance: 'implementationGuidance',
    conmon_status: 'conmonStatus', conmonStatus: 'conmonStatus',
    conmon_group: 'conmonGroup', conmonGroup: 'conmonGroup',
    conmon_frequency: 'conmonFrequency', conmonFrequency: 'conmonFrequency',
  };
  const data = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const existing = await db.control.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    const siteId = req.tenantSiteId || existing.siteId;
    if (siteId) data.siteId = siteId;

    const doc = await db.control.update({ where: { id: req.params.id }, data });

    if (data.conmonStatus === 'Compliant') {
      const today = new Date().toISOString().split('T')[0];
      const cms   = await db.conMon.findMany({
        where: { linkedControls: { has: req.params.id }, status: { not: 'Completed' } },
      });
      for (const cm of cms) {
        if (!cm.linkedControls?.length) continue;
        const compliantN = await db.control.count({
          where: { id: { in: cm.linkedControls }, conmonStatus: 'Compliant' },
        });
        if (compliantN >= cm.linkedControls.length) {
          await db.conMon.update({ where: { id: cm.id }, data: { status: 'Completed', completedDate: today } });
          await db.task.updateMany({ where: { source: 'conmon', sourceId: cm.id }, data: { status: 'Completed' } });
        }
      }
    }

    await audit(actor(req), 'CONTROL_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, doc.siteId);
    res.json(serializeControl(doc));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.control.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.control.delete({ where: { id: req.params.id } });
    await audit(actor(req), 'CONTROL_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
