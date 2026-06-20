'use strict';

const express = require('express');
const { db } = require('../../../packages/db/src/index');
const audit = require('../middleware/audit');

const router = express.Router();

function actor(req) {
  return req.user?.username || req.session?.user?.username || 'system';
}

function mapImplementationToLegacy(doc) {
  const catalog = doc.controlCatalog || {};
  return {
    id: doc.id,
    control_id: catalog.controlKey,
    title: catalog.title || '',
    family: catalog.family || '',
    status: doc.status || 'Not Implemented',
    baseline: catalog.baseline || '',
    last_review: doc.lastReview || null,
    findings: Array.isArray(doc.findingsRecords) ? doc.findingsRecords.filter(f => f.status !== 'Closed').length : (doc.findings || 0),
    notes: doc.notes || null,
    description: catalog.description || null,
    implementation_guidance: doc.implementationGuidance || null,
    conmon_status: doc.conmonStatus || 'Open',
    conmon_group: doc.conmonGroup || null,
    conmon_frequency: doc.conmonFrequency || null,
    site_id: doc.siteId || null,
    tenant_id: doc.tenantId || null,
  };
}

async function findImplementationForRequest(req, id) {
  const rows = await db.siteControlImplementation.findMany({
    where: req.applyTenantFilter({
      OR: [
        { id },
        { controlCatalog: { controlKey: id } },
      ],
    }),
    include: {
      controlCatalog: true,
      findingsRecords: true,
      evidenceArtifacts: true,
    },
    take: 2,
  });

  if (!rows.length) return null;
  if (rows.length > 1) {
    const err = new Error('Multiple site control implementations matched this control ID. Select a specific site first.');
    err.status = 409;
    throw err;
  }
  return rows[0];
}

async function touchConMonIfCompliant(req, siteId, controlKey, conmonStatus) {
  if (conmonStatus !== 'Compliant' || !controlKey || !siteId) return;

  const today = new Date().toISOString().split('T')[0];
  const cms = await db.conMon.findMany({
    where: req.applyTenantFilter({
      siteId,
      linkedControls: { has: controlKey },
      status: { not: 'Completed' },
    }),
  });

  for (const cm of cms) {
    if (!cm.linkedControls?.length) continue;
    const compliantN = await db.siteControlImplementation.count({
      where: req.applyTenantFilter({
        siteId,
        conmonStatus: 'Compliant',
        controlCatalog: {
          controlKey: { in: cm.linkedControls },
        },
      }),
    });
    if (compliantN >= cm.linkedControls.length) {
      await db.conMon.update({ where: { id: cm.id }, data: { status: 'Completed', completedDate: today } });
      await db.task.updateMany({ where: { source: 'conmon', sourceId: cm.id }, data: { status: 'Completed' } });
    }
  }
}

router.get('/', async (req, res, next) => {
  try {
    const docs = await db.siteControlImplementation.findMany({
      where: req.applyTenantFilter({}),
      include: {
        controlCatalog: true,
        findingsRecords: true,
        evidenceArtifacts: true,
      },
      orderBy: [
        { controlCatalog: { family: 'asc' } },
        { controlCatalog: { controlKey: 'asc' } },
      ],
    });
    res.json(docs.map(mapImplementationToLegacy));
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-delete', async (req, res, next) => {
  const ids = Array.isArray(req.body?.ids)
    ? [...new Set(req.body.ids.map(String).map(v => v.trim()).filter(Boolean))]
    : [];

  if (!ids.length) return res.status(400).json({ error: 'ids must be a non-empty array' });

  try {
    const allowed = await db.siteControlImplementation.findMany({
      where: req.applyTenantFilter({ id: { in: ids } }),
      select: { id: true, siteId: true },
    });
    const allowedIds = allowed.map(d => d.id);
    if (!allowedIds.length) {
      return res.json({ requested: ids.length, deletedCount: 0, ignored: ids.length });
    }

    const result = await db.siteControlImplementation.deleteMany({
      where: req.applyTenantFilter({ id: { in: allowedIds } }),
    });

    await audit(
      actor(req),
      'CONTROL_BULK_DELETE',
      'bulk',
      `Deleted ${result.count} site control implementations in bulk`,
      req.tenantSiteId || allowed[0]?.siteId || req.user?.siteId || null
    );

    res.json({ requested: ids.length, deletedCount: result.count, ignored: ids.length - result.count });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await findImplementationForRequest(req, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(mapImplementationToLegacy(doc));
  } catch (err) {
    next(err);
  }
});

router.post('/bulk', async (req, res, next) => {
  const { controls, overwrite = false } = req.body || {};
  const siteId = req.resolveTenantSiteId(req.body);
  if (!siteId) return res.status(400).json({ error: 'siteId is required' });
  if (!Array.isArray(controls) || !controls.length) {
    return res.status(400).json({ error: 'controls must be a non-empty array' });
  }

  const docs = controls.map(c => ({
    controlKey: String(c.id || c.control_id || '').trim(),
    title: c.title || '',
    family: c.family || '',
    status: c.status || 'Not Implemented',
    baseline: c.baseline || null,
    lastReview: c.last_review || null,
    findings: Number(c.findings) || 0,
    notes: c.notes || null,
    description: c.description || null,
    implementationGuidance: c.implementation_guidance || null,
    conmonStatus: c.conmon_status || 'Open',
    conmonGroup: c.conmon_group || null,
    conmonFrequency: c.conmon_frequency || null,
  })).filter(d => d.controlKey && d.title);

  if (!docs.length) {
    return res.status(400).json({ error: 'No valid controls (each needs an id and title)' });
  }

  let inserted = 0;
  let skipped = 0;
  let overwritten = 0;
  const errors = [];

  try {
    for (const d of docs) {
      try {
        const catalog = await db.controlCatalog.upsert({
          where: {
            tenantId_ownerType_ownerSiteId_controlKey: {
              tenantId: null,
              ownerType: 'site',
              ownerSiteId: siteId,
              controlKey: d.controlKey,
            },
          },
          create: {
            controlKey: d.controlKey,
            title: d.title,
            family: d.family || null,
            baseline: d.baseline || null,
            description: d.description || null,
            ownerType: 'site',
            ownerSiteId: siteId,
          },
          update: overwrite ? {
            title: d.title,
            family: d.family || null,
            baseline: d.baseline || null,
            description: d.description || null,
          } : {},
        });

        const existing = await db.siteControlImplementation.findUnique({
          where: { siteId_controlCatalogId: { siteId, controlCatalogId: catalog.id } },
          select: { id: true },
        });

        if (existing && !overwrite) {
          skipped += 1;
          continue;
        }

        if (existing && overwrite) {
          await db.siteControlImplementation.update({
            where: { id: existing.id },
            data: {
              status: d.status,
              lastReview: d.lastReview,
              findings: d.findings,
              notes: d.notes,
              implementationGuidance: d.implementationGuidance,
              conmonStatus: d.conmonStatus,
              conmonGroup: d.conmonGroup,
              conmonFrequency: d.conmonFrequency,
            },
          });
          overwritten += 1;
        } else {
          await db.siteControlImplementation.create({
            data: {
              siteId,
              controlCatalogId: catalog.id,
              status: d.status,
              lastReview: d.lastReview,
              findings: d.findings,
              notes: d.notes,
              implementationGuidance: d.implementationGuidance,
              conmonStatus: d.conmonStatus,
              conmonGroup: d.conmonGroup,
              conmonFrequency: d.conmonFrequency,
            },
          });
          inserted += 1;
        }
      } catch (e) {
        errors.push({ id: d.controlKey, reason: e.message });
      }
    }
  } catch (err) {
    return next(err);
  }

  await audit(
    actor(req),
    'CONTROLS_BULK_IMPORT',
    'bulk',
    `Bulk import: ${overwrite ? overwritten : inserted} added, ${skipped} skipped`,
    siteId
  );

  res.json({
    inserted: overwrite ? 0 : inserted,
    overwritten: overwrite ? overwritten : 0,
    skipped,
    errors: errors.slice(0, 20),
  });
});

router.post('/', async (req, res, next) => {
  const {
    id,
    title,
    family,
    status,
    baseline,
    last_review,
    findings,
    notes,
    description,
    implementation_guidance,
    conmon_status,
    conmon_group,
    conmon_frequency,
  } = req.body || {};

  const siteId = req.resolveTenantSiteId(req.body);
  const controlKey = String(id || req.body?.control_id || '').trim();
  if (!siteId) return res.status(400).json({ error: 'siteId is required' });
  if (!controlKey || !title) return res.status(400).json({ error: 'id and title are required' });

  try {
    const catalog = await db.controlCatalog.create({
      data: {
        controlKey,
        title,
        family: family || null,
        baseline: baseline || null,
        description: description || null,
        ownerType: 'site',
        ownerSiteId: siteId,
      },
    });

    const doc = await db.siteControlImplementation.create({
      data: {
        siteId,
        controlCatalogId: catalog.id,
        status: status || 'Not Implemented',
        lastReview: last_review || null,
        findings: findings || 0,
        notes: notes || null,
        implementationGuidance: implementation_guidance || null,
        conmonStatus: conmon_status || 'Open',
        conmonGroup: conmon_group || null,
        conmonFrequency: conmon_frequency || null,
      },
      include: {
        controlCatalog: true,
        findingsRecords: true,
        evidenceArtifacts: true,
      },
    });

    await audit(actor(req), 'CONTROL_ADD', controlKey, `Added: ${title}`, siteId);
    res.status(201).json(mapImplementationToLegacy(doc));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  const implFieldMap = {
    status: 'status',
    last_review: 'lastReview',
    lastReview: 'lastReview',
    findings: 'findings',
    notes: 'notes',
    implementation_guidance: 'implementationGuidance',
    implementationGuidance: 'implementationGuidance',
    conmon_status: 'conmonStatus',
    conmonStatus: 'conmonStatus',
    conmon_group: 'conmonGroup',
    conmonGroup: 'conmonGroup',
    conmon_frequency: 'conmonFrequency',
    conmonFrequency: 'conmonFrequency',
  };
  const catalogFieldMap = {
    title: 'title',
    family: 'family',
    baseline: 'baseline',
    description: 'description',
  };

  const implData = {};
  const catalogData = {};
  for (const [k, pk] of Object.entries(implFieldMap)) {
    if (k in req.body) implData[pk] = req.body[k];
  }
  for (const [k, pk] of Object.entries(catalogFieldMap)) {
    if (k in req.body) catalogData[pk] = req.body[k];
  }
  if (!Object.keys(implData).length && !Object.keys(catalogData).length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const existing = await findImplementationForRequest(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    if (Object.keys(catalogData).length) {
      await db.controlCatalog.update({ where: { id: existing.controlCatalogId }, data: catalogData });
    }

    const updated = await db.siteControlImplementation.update({
      where: { id: existing.id },
      data: implData,
      include: {
        controlCatalog: true,
        findingsRecords: true,
        evidenceArtifacts: true,
      },
    });

    await touchConMonIfCompliant(req, updated.siteId, updated.controlCatalog?.controlKey, implData.conmonStatus);

    await audit(
      actor(req),
      'CONTROL_UPDATE',
      updated.controlCatalog?.controlKey || updated.id,
      `Updated: ${[...Object.keys(catalogData), ...Object.keys(implData)].join(', ')}`,
      updated.siteId
    );
    res.json(mapImplementationToLegacy(updated));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await findImplementationForRequest(req, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    await db.siteControlImplementation.delete({ where: { id: doc.id } });

    const remaining = await db.siteControlImplementation.count({
      where: { controlCatalogId: doc.controlCatalogId },
    });
    if (!remaining && doc.controlCatalog?.ownerType === 'site') {
      await db.controlCatalog.delete({ where: { id: doc.controlCatalogId } });
    }

    await audit(actor(req), 'CONTROL_DELETE', doc.controlCatalog?.controlKey || doc.id, 'Deleted', doc.siteId);
    res.json({ deleted: doc.id, control_id: doc.controlCatalog?.controlKey || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
