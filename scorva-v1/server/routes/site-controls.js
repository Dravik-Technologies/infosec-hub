'use strict';

const express = require('express');
const { db } = require('../../../packages/db/src');
const audit = require('../middleware/audit');

const router = express.Router();

function actor(req) {
  return req.user?.username || req.session?.user?.username || 'system';
}

async function createLinkedTaskForPoam(poamId, title, siteId, responsibleParty, scheduledCompletion, severity, username) {
  try {
    const last = await db.task.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(String(last.id).replace('TF-', ''), 10) || 0 : 0;
    const taskId = 'TF-' + String(lastNum + 1).padStart(4, '0');
    await db.task.create({
      data: {
        id: taskId,
        title,
        siteId,
        type: 'Finding',
        status: 'Open',
        priority: severity === 'Critical' ? 'Critical' : severity === 'High' ? 'High' : 'Medium',
        assignee: responsibleParty || null,
        dueDate: scheduledCompletion || null,
        created: new Date().toISOString().split('T')[0],
        source: 'poam',
        sourceId: poamId,
        createdBy: username || null,
      },
    });
  } catch (err) {
    console.error('[SCORVA] site control POA&M task auto-create failed for', poamId, ':', err.message);
  }
}

async function attachFindingPoamLinks(doc) {
  if (!doc || !Array.isArray(doc.findingsRecords) || doc.findingsRecords.length === 0) return doc;
  const findingIds = doc.findingsRecords.map(finding => finding.id);
  const linkedPoams = await db.poam.findMany({
    where: {
      siteId: doc.siteId,
      sourceType: 'siteControlFinding',
      sourceId: { in: findingIds },
    },
    select: { id: true, sourceId: true, status: true },
  });
  const poamByFindingId = new Map(linkedPoams.map(row => [row.sourceId, row]));

  return {
    ...doc,
    findingsRecords: doc.findingsRecords.map(finding => {
      const poam = poamByFindingId.get(finding.id);
      return poam
        ? { ...finding, poamId: poam.id, poamStatus: poam.status }
        : finding;
    }),
  };
}

function serializeImplementation(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    last_review: doc.lastReview,
    implementation_guidance: doc.implementationGuidance,
    conmon_status: doc.conmonStatus,
    conmon_group: doc.conmonGroup,
    conmon_frequency: doc.conmonFrequency,
    assigned_to: doc.assignedTo,
    evidence_summary: doc.evidenceSummary,
    control_catalog_id: doc.controlCatalogId,
    site_id: doc.siteId,
    tenant_id: doc.tenantId,
  };
}

function buildCatalogWhere(req) {
  const selectedSiteId = req.tenantSiteId || req.query?.siteId || null;
  const ownerScope = String(req.body?.ownerScope || req.query?.ownerScope || 'all').trim();
  const or = [];

  if (ownerScope === 'all' || ownerScope === 'enterprise') {
    or.push({ ownerType: 'enterprise' });
  }
  if (ownerScope === 'all' || ownerScope === 'site') {
    if (selectedSiteId) {
      or.push({ ownerType: 'site', ownerSiteId: selectedSiteId });
    } else if (req.tenantSiteIds?.length) {
      or.push({ ownerType: 'site', ownerSiteId: { in: req.tenantSiteIds } });
    }
  }

  return or.length ? { OR: or } : { id: '__no_match__' };
}

router.get('/', async (req, res, next) => {
  const status = req.query?.status ? String(req.query.status).trim() : null;
  const controlCatalogId = req.query?.controlCatalogId ? String(req.query.controlCatalogId).trim() : null;
  const family = req.query?.family ? String(req.query.family).trim() : null;
  const q = req.query?.q ? String(req.query.q).trim() : null;

  try {
    const where = req.applyTenantFilter({});
    if (status) where.status = status;
    if (controlCatalogId) where.controlCatalogId = controlCatalogId;
    if (family || q) {
      where.controlCatalog = {};
      if (family) where.controlCatalog.family = family;
      if (q) {
        where.OR = [
          { notes: { contains: q, mode: 'insensitive' } },
          { assignedTo: { contains: q, mode: 'insensitive' } },
          { controlCatalog: { controlKey: { contains: q, mode: 'insensitive' } } },
          { controlCatalog: { title: { contains: q, mode: 'insensitive' } } },
          { controlCatalog: { family: { contains: q, mode: 'insensitive' } } },
        ];
      }
    }

    const rows = await db.siteControlImplementation.findMany({
      where,
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

    res.json(rows.map(serializeImplementation));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await db.siteControlImplementation.findUnique({
      where: { id: req.params.id },
      include: {
        controlCatalog: true,
        findingsRecords: true,
        evidenceArtifacts: true,
      },
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    const hydrated = await attachFindingPoamLinks(doc);
    res.json(serializeImplementation(hydrated));
  } catch (err) {
    next(err);
  }
});

router.post('/sync-from-catalog', async (req, res, next) => {
  const siteId = req.resolveTenantSiteId(req.body);
  const requestedCatalogIds = Array.isArray(req.body?.controlCatalogIds)
    ? req.body.controlCatalogIds.map(String).map(v => v.trim()).filter(Boolean)
    : [];

  try {
    const catalogWhere = buildCatalogWhere(req);
    if (requestedCatalogIds.length) catalogWhere.id = { in: requestedCatalogIds };

    const catalogRows = await db.controlCatalog.findMany({
      where: catalogWhere,
      orderBy: [{ family: 'asc' }, { controlKey: 'asc' }],
    });

    let created = 0;
    let skipped = 0;

    for (const row of catalogRows) {
      const existing = await db.siteControlImplementation.findUnique({
        where: { siteId_controlCatalogId: { siteId, controlCatalogId: row.id } },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await db.siteControlImplementation.create({
        data: {
          siteId,
          controlCatalogId: row.id,
          status: 'Not Implemented',
          implementationGuidance: row.implementationDefault || null,
        },
      });
      created += 1;
    }

    await audit(actor(req), 'SITE_CONTROL_SYNC', siteId, `Synced ${created} controls from catalog`, siteId);
    res.json({ siteId, catalogCount: catalogRows.length, created, skipped });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
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
    assigned_to: 'assignedTo',
    assignedTo: 'assignedTo',
    evidence_summary: 'evidenceSummary',
    evidenceSummary: 'evidenceSummary',
  };

  const data = {};
  for (const [incoming, target] of Object.entries(FIELD_MAP)) {
    if (incoming in req.body) data[target] = req.body[incoming];
  }
  if (!Object.keys(data).length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const existing = await db.siteControlImplementation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    const updated = await db.siteControlImplementation.update({
      where: { id: req.params.id },
      data,
      include: {
        controlCatalog: true,
        findingsRecords: true,
        evidenceArtifacts: true,
      },
    });
    await audit(actor(req), 'SITE_CONTROL_UPDATE', updated.id, `Updated site control fields: ${Object.keys(data).join(', ')}`, updated.siteId);
    res.json(serializeImplementation(updated));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await db.siteControlImplementation.findUnique({
      where: { id: req.params.id },
      include: { controlCatalog: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    await db.siteControlImplementation.delete({ where: { id: existing.id } });
    await audit(
      actor(req),
      'SITE_CONTROL_DELETE',
      existing.id,
      `Deleted site control implementation for ${existing.controlCatalog?.controlKey || existing.controlCatalogId}`,
      existing.siteId
    );
    res.json({ ok: true, id: existing.id });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/findings', async (req, res, next) => {
  const { title, description, severity, status } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const existing = await db.siteControlImplementation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Control implementation not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    const finding = await db.siteControlFinding.create({
      data: {
        siteControlId: existing.id,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        severity: severity ? String(severity).trim() : null,
        status: status ? String(status).trim() : 'Open',
      },
    });

    const openFindings = await db.siteControlFinding.count({
      where: { siteControlId: existing.id, status: { notIn: ['Closed', 'Resolved'] } },
    });
    await db.siteControlImplementation.update({
      where: { id: existing.id },
      data: { findings: openFindings },
    });

    await audit(actor(req), 'SITE_CONTROL_FINDING_ADD', finding.id, `Added finding to site control ${existing.id}`, existing.siteId);
    res.status(201).json(finding);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/findings/:findingId', async (req, res, next) => {
  try {
    const existing = await db.siteControlImplementation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Control implementation not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    const finding = await db.siteControlFinding.findUnique({ where: { id: req.params.findingId } });
    if (!finding || finding.siteControlId !== existing.id) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    const patch = {};
    if ('title' in req.body) patch.title = req.body.title ? String(req.body.title).trim() : '';
    if ('description' in req.body) patch.description = req.body.description ? String(req.body.description).trim() : null;
    if ('severity' in req.body) patch.severity = req.body.severity ? String(req.body.severity).trim() : null;
    if ('status' in req.body) {
      patch.status = req.body.status ? String(req.body.status).trim() : 'Open';
      patch.closedAt = ['Closed', 'Resolved'].includes(patch.status) ? new Date() : null;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No fields to update' });

    const updatedFinding = await db.siteControlFinding.update({
      where: { id: finding.id },
      data: patch,
    });
    const openFindings = await db.siteControlFinding.count({
      where: { siteControlId: existing.id, status: { notIn: ['Closed', 'Resolved'] } },
    });
    await db.siteControlImplementation.update({
      where: { id: existing.id },
      data: { findings: openFindings },
    });

    await audit(actor(req), 'SITE_CONTROL_FINDING_UPDATE', updatedFinding.id, `Updated finding status to ${updatedFinding.status}`, existing.siteId);
    res.json(updatedFinding);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/findings/:findingId/poam', async (req, res, next) => {
  try {
    const existing = await db.siteControlImplementation.findUnique({
      where: { id: req.params.id },
      include: { controlCatalog: true },
    });
    if (!existing) return res.status(404).json({ error: 'Control implementation not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    const finding = await db.siteControlFinding.findUnique({ where: { id: req.params.findingId } });
    if (!finding || finding.siteControlId !== existing.id) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    const linkedPoam = await db.poam.findFirst({
      where: {
        siteId: existing.siteId,
        sourceType: 'siteControlFinding',
        sourceId: finding.id,
      },
      select: { id: true },
    });
    if (linkedPoam) {
      return res.status(409).json({ error: 'Finding already linked to a POA&M', poamId: linkedPoam.id });
    }

    const last = await db.poam.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(String(last.id).replace('POA-', ''), 10) || 0 : 0;
    const poamId = 'POA-' + String(lastNum + 1).padStart(3, '0');
    const controlKey = existing.controlCatalog?.controlKey || existing.controlCatalogId;
    const today = new Date().toISOString().split('T')[0];
    const {
      title,
      weakness,
      severity,
      status,
      responsible_party,
      scheduled_completion,
      poam_type,
      comments,
      risk_decision,
      risk_rationale,
    } = req.body || {};

    const poam = await db.poam.create({
      data: {
        id: poamId,
        title: title ? String(title).trim() : `${controlKey}: ${finding.title}`,
        controlId: controlKey || null,
        weakness: weakness ? String(weakness).trim() : (finding.description || `Control implementation finding for ${controlKey || 'site control'}`),
        severity: severity ? String(severity).trim() : (finding.severity || 'Medium'),
        status: status ? String(status).trim() : 'Open',
        siteId: existing.siteId,
        sourceType: 'siteControlFinding',
        sourceId: finding.id,
        responsibleParty: responsible_party ? String(responsible_party).trim() : (existing.assignedTo || null),
        pointOfContact: actor(req),
        scheduledCompletion: scheduled_completion ? String(scheduled_completion).trim() : null,
        identifiedDate: today,
        poamType: poam_type ? String(poam_type).trim() : 'Control Finding',
        comments: comments
          ? String(comments).trim()
          : `Generated from site control implementation ${existing.id} for finding ${finding.id}.`,
        riskDecision: risk_decision ? String(risk_decision).trim() : null,
        riskRationale: risk_rationale ? String(risk_rationale).trim() : null,
      },
    });

    await createLinkedTaskForPoam(
      poam.id,
      poam.title,
      poam.siteId,
      poam.responsibleParty,
      poam.scheduledCompletion,
      poam.severity,
      actor(req)
    );

    await audit(actor(req), 'SITE_CONTROL_FINDING_POAM_ADD', poam.id, `Created POA&M from finding ${finding.id}`, existing.siteId);
    res.status(201).json({ poamId: poam.id, poam });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/evidence', async (req, res, next) => {
  const { artifactType, fileName, url, notes } = req.body || {};

  try {
    const existing = await db.siteControlImplementation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Control implementation not found' });
    if (!req.assertTenantDocument(existing)) return res.status(403).json({ error: 'Forbidden' });

    const evidence = await db.siteControlEvidence.create({
      data: {
        siteControlId: existing.id,
        artifactType: artifactType ? String(artifactType).trim() : null,
        fileName: fileName ? String(fileName).trim() : null,
        url: url ? String(url).trim() : null,
        notes: notes ? String(notes).trim() : null,
        uploadedBy: actor(req),
      },
    });

    await audit(actor(req), 'SITE_CONTROL_EVIDENCE_ADD', evidence.id, `Added evidence to site control ${existing.id}`, existing.siteId);
    res.status(201).json(evidence);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
