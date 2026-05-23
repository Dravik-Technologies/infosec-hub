'use strict';

const express = require('express');
const crypto = require('crypto');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');

const router = express.Router();

function actor(req) {
  return req.user?.username || req.session?.user?.username || 'system';
}

function isAdmin(req) {
  const role = req.user?.role;
  return role === 'Corporate Admin' || role === 'Site Admin';
}

function serializeCampaign(c) {
  return {
    id:              c.id,
    siteId:          c.siteId,
    templateId:      c.templateId,
    templateName:    c.templateName,
    templateVersion: c.templateVersion,
    name:            c.name,
    status:          c.status,
    startDate:       c.startDate,
    targetDate:      c.targetDate,
    completedAt:     c.completedAt,
    ownerName:       c.ownerName,
    notes:           c.notes,
    createdBy:       c.createdBy,
    createdAt:       c.createdAt,
    updatedAt:       c.updatedAt,
  };
}

// ── List campaigns ──────────────────────────────────────────────────────────
router.get('/campaigns', async (req, res, next) => {
  try {
    const docs = await db.inspectionCampaign.findMany({
      where:   req.applyTenantFilter({}),
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true, siteId: true, name: true, status: true,
        templateName: true, templateVersion: true,
        startDate: true, targetDate: true, completedAt: true,
        ownerName: true, createdBy: true, createdAt: true, updatedAt: true,
        _count: { select: { items: true } },
      },
    });

    // Attach per-campaign progress counts
    const ids = docs.map(d => d.id);
    const statusCounts = ids.length
      ? await db.inspectionCampaignItem.groupBy({
          by: ['campaignId', 'status'],
          where: { campaignId: { in: ids } },
          _count: { status: true },
        })
      : [];

    const countMap = {};
    for (const row of statusCounts) {
      if (!countMap[row.campaignId]) countMap[row.campaignId] = {};
      countMap[row.campaignId][row.status] = row._count.status;
    }

    const result = docs.map(d => ({
      ...d,
      totalItems:    d._count.items,
      notStarted:    countMap[d.id]?.['Not Started'] || 0,
      inProgress:    countMap[d.id]?.['In Progress'] || 0,
      complete:      countMap[d.id]?.['Complete']    || 0,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// ── Create campaign (admin only) ────────────────────────────────────────────
router.post('/campaigns', async (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only' });

  const { name, templateId, startDate, targetDate, ownerName, notes } = req.body;
  if (!name?.trim())      return res.status(400).json({ error: 'name is required' });
  if (!templateId?.trim()) return res.status(400).json({ error: 'templateId is required' });

  const siteId = req.resolveTenantSiteId(req.body);
  if (!siteId) return res.status(400).json({ error: 'siteId is required' });

  try {
    const template = await db.checklistTemplate.findUnique({
      where:   { id: templateId },
      include: {
        sections: {
          orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
          include: {
            items: {
              orderBy: [{ sortOrder: 'asc' }],
            },
          },
        },
      },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const campaign = await db.$transaction(async (tx) => {
      const c = await tx.inspectionCampaign.create({
        data: {
          siteId,
          templateId:      template.id,
          templateName:    template.name,
          templateVersion: template.version || null,
          name:            name.trim(),
          status:          'Draft',
          startDate:       startDate  ? new Date(startDate)  : null,
          targetDate:      targetDate ? new Date(targetDate) : null,
          ownerName:       ownerName?.trim() || null,
          notes:           notes?.trim()     || null,
          createdBy:       actor(req),
        },
      });

      const sectionRows = template.sections.map(section => ({
        id:                crypto.randomUUID(),
        campaignId:        c.id,
        templateSectionId: section.id,
        sectionCode:       section.sectionCode || null,
        title:             section.title,
        sortOrder:         section.sortOrder,
      }));

      if (sectionRows.length) {
        await tx.inspectionCampaignSection.createMany({ data: sectionRows });
      }

      const sectionIdByTemplateId = new Map(
        sectionRows.map(section => [section.templateSectionId, section.id])
      );

      const itemRows = template.sections.flatMap(section => (
        section.items.map(item => ({
          id:                crypto.randomUUID(),
          campaignId:        c.id,
          sectionId:         sectionIdByTemplateId.get(section.id),
          templateItemId:    item.id,
          itemCode:          item.itemCode          || null,
          nispomRef:         item.nispomRef         || null,
          questionText:      item.questionText,
          applicabilityNote: item.applicabilityNote || null,
          riskCategory:      item.riskCategory      || null,
          evidenceRequired:  item.evidenceRequired,
          controlRef:        item.controlRef        || null,
          sortOrder:         item.sortOrder,
        }))
      ));

      if (itemRows.length) {
        await tx.inspectionCampaignItem.createMany({ data: itemRows });
      }

      return c;
    });

    await audit(actor(req), 'CAMPAIGN_CREATE', 'InspectionCampaign', `Created campaign "${campaign.name}"`, siteId);
    res.status(201).json(serializeCampaign(campaign));
  } catch (err) { next(err); }
});

// ── Get campaign detail (with section progress) ────────────────────────────
router.get('/campaigns/:id', async (req, res, next) => {
  try {
    const doc = await db.inspectionCampaign.findUnique({
      where: { id: req.params.id },
      include: {
        sections: {
          orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
          include: {
            items: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!doc) return res.status(404).json({ error: 'Campaign not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });

    const sections = doc.sections.map(s => {
      const total      = s.items.length;
      const complete   = s.items.filter(i => i.status === 'Complete').length;
      const inProgress = s.items.filter(i => i.status === 'In Progress').length;
      const notStarted = total - complete - inProgress;
      return {
        id: s.id, sectionCode: s.sectionCode, title: s.title,
        sortOrder: s.sortOrder, status: s.status, completedAt: s.completedAt,
        totalItems: total, complete, inProgress, notStarted,
      };
    });

    const allItems   = doc.sections.flatMap(s => s.items);
    const totalItems = allItems.length;
    const complete   = allItems.filter(i => i.status === 'Complete').length;
    const inProgress = allItems.filter(i => i.status === 'In Progress').length;

    res.json({
      ...serializeCampaign(doc),
      sections,
      progress: { totalItems, complete, inProgress, notStarted: totalItems - complete - inProgress },
    });
  } catch (err) { next(err); }
});

// ── Update campaign metadata / status (admin only) ─────────────────────────
router.patch('/campaigns/:id', async (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only' });

  try {
    const doc = await db.inspectionCampaign.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Campaign not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });

    const { name, status, startDate, targetDate, ownerName, notes } = req.body;
    const data = {};
    if (name       !== undefined) data.name       = name.trim();
    if (status     !== undefined) data.status     = status;
    if (ownerName  !== undefined) data.ownerName  = ownerName?.trim() || null;
    if (notes      !== undefined) data.notes      = notes?.trim()     || null;
    if (startDate  !== undefined) data.startDate  = startDate  ? new Date(startDate)  : null;
    if (targetDate !== undefined) data.targetDate = targetDate ? new Date(targetDate) : null;
    if (status === 'Complete' && !doc.completedAt) data.completedAt = new Date();
    if (status && status !== 'Complete')            data.completedAt = null;

    const updated = await db.inspectionCampaign.update({ where: { id: req.params.id }, data });
    await audit(actor(req), 'CAMPAIGN_UPDATE', 'InspectionCampaign', `Updated campaign "${updated.name}"`, doc.siteId);
    res.json(serializeCampaign(updated));
  } catch (err) { next(err); }
});

// ── Get campaign items ──────────────────────────────────────────────────────
router.get('/campaign-items', async (req, res, next) => {
  const campaignId = String(req.query.campaignId || '').trim();
  const sectionId  = String(req.query.sectionId  || '').trim();
  const search     = String(req.query.search     || '').trim();
  const status     = String(req.query.status     || '').trim();

  if (!campaignId) return res.status(400).json({ error: 'campaignId is required' });

  try {
    // Verify tenant access on campaign
    const campaign = await db.inspectionCampaign.findUnique({
      where: { id: campaignId }, select: { siteId: true },
    });
    if (!campaign)                               return res.status(404).json({ error: 'Campaign not found' });
    if (!req.assertTenantDocument(campaign))     return res.status(403).json({ error: 'Forbidden' });

    const where = { campaignId };
    if (sectionId) where.sectionId = sectionId;
    if (status)    where.status    = status;
    if (search) {
      where.OR = [
        { questionText: { contains: search, mode: 'insensitive' } },
        { itemCode:     { contains: search, mode: 'insensitive' } },
        { nispomRef:    { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await db.inspectionCampaignItem.findMany({
      where,
      orderBy: [{ section: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: {
        id: true, itemCode: true, nispomRef: true, questionText: true,
        applicabilityNote: true, riskCategory: true, evidenceRequired: true,
        controlRef: true, sortOrder: true, status: true, workNotes: true,
        updatedBy: true, statusUpdatedAt: true, taskId: true, poamId: true,
        section: { select: { id: true, sectionCode: true, title: true } },
      },
    });
    res.json(items);
  } catch (err) { next(err); }
});

// ── Update campaign item status + notes (admin only) ───────────────────────
router.patch('/campaign-items/:id', async (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only' });

  try {
    const doc = await db.inspectionCampaignItem.findUnique({
      where: { id: req.params.id },
      select: { id: true, campaignId: true, status: true },
    });
    if (!doc) return res.status(404).json({ error: 'Item not found' });

    const campaign = await db.inspectionCampaign.findUnique({
      where: { id: doc.campaignId }, select: { siteId: true },
    });
    if (!req.assertTenantDocument(campaign)) return res.status(403).json({ error: 'Forbidden' });

    const { status, workNotes } = req.body;
    const data = { updatedBy: actor(req) };
    if (status    !== undefined) { data.status = status; data.statusUpdatedAt = new Date(); }
    if (workNotes !== undefined) { data.workNotes = workNotes || null; }

    const updated = await db.inspectionCampaignItem.update({
      where: { id: req.params.id }, data,
      select: {
        id: true, status: true, workNotes: true,
        updatedBy: true, statusUpdatedAt: true,
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── Update campaign section status (admin only) ────────────────────────────
router.patch('/campaign-sections/:id', async (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only' });

  try {
    const doc = await db.inspectionCampaignSection.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { siteId: true } } },
    });
    if (!doc) return res.status(404).json({ error: 'Section not found' });
    if (!req.assertTenantDocument(doc.campaign)) return res.status(403).json({ error: 'Forbidden' });

    const { status } = req.body;
    const data = {};
    if (status !== undefined) {
      data.status      = status;
      data.completedAt = status === 'Complete' ? new Date() : null;
    }

    const updated = await db.inspectionCampaignSection.update({
      where: { id: req.params.id }, data,
      select: { id: true, status: true, completedAt: true },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── Create task from campaign item (admin only) ────────────────────────────
router.post('/campaign-items/:id/task', async (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only' });

  try {
    const item = await db.inspectionCampaignItem.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: { select: { siteId: true, name: true, targetDate: true } },
        section:  { select: { sectionCode: true, title: true } },
      },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const campaign = item.campaign;
    if (!req.assertTenantDocument(campaign)) return res.status(403).json({ error: 'Forbidden' });
    if (item.taskId) return res.status(409).json({ error: 'A task is already linked to this item', taskId: item.taskId });

    const PRIORITY_MAP = { Critical: 'High', Significant: 'Medium', Minor: 'Low' };
    const priority    = PRIORITY_MAP[item.riskCategory] || 'Low';
    const questionSnip = item.questionText.length > 60
      ? item.questionText.slice(0, 57) + '…'
      : item.questionText;
    const title = `DCSA Self-Inspection: ${item.itemCode ? item.itemCode + ' ' : ''}${questionSnip}`;

    const notesLines = [
      `Campaign: ${campaign.name}`,
      `Section: ${item.section?.sectionCode ? item.section.sectionCode + ' · ' : ''}${item.section?.title || ''}`,
      item.itemCode  ? `Item Code: ${item.itemCode}`  : null,
      item.nispomRef ? `NISPOM Ref: ${item.nispomRef}` : null,
      '',
      item.questionText,
      item.workNotes ? `\nWork Notes: ${item.workNotes}` : null,
    ].filter(l => l !== null).join('\n');

    const last    = await db.task.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('TF-', '')) || 0 : 0;
    const taskId  = 'TF-' + String(lastNum + 1).padStart(4, '0');

    const task = await db.task.create({
      data: {
        id: taskId, title, siteId: campaign.siteId,
        type: 'Task', status: 'Open', priority,
        dueDate:   campaign.targetDate ? campaign.targetDate.toISOString().split('T')[0] : null,
        notes:     notesLines,
        source:    'InspectionCampaignItem',
        sourceId:  item.id,
        createdBy: actor(req),
        created:   new Date().toISOString().split('T')[0],
      },
    });

    await db.inspectionCampaignItem.update({
      where: { id: item.id },
      data: { taskId: task.id, updatedBy: actor(req) },
    });

    await audit(actor(req), 'CAMPAIGN_ITEM_TASK_CREATE', task.id,
      `Linked task "${title}" from campaign item ${item.id}`, campaign.siteId);

    res.status(201).json({ taskId: task.id, task });
  } catch (err) { next(err); }
});

// ── Create POA&M from campaign item (admin only) ───────────────────────────
router.post('/campaign-items/:id/poam', async (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden: admin only' });

  try {
    const item = await db.inspectionCampaignItem.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: { select: { siteId: true, name: true } },
        section:  { select: { sectionCode: true, title: true } },
      },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const campaign = item.campaign;
    if (!req.assertTenantDocument(campaign)) return res.status(403).json({ error: 'Forbidden' });
    if (item.poamId) return res.status(409).json({ error: 'A POA&M is already linked to this item', poamId: item.poamId });

    const SEVERITY_MAP = { Critical: 'High', Significant: 'Medium', Minor: 'Low' };
    const severity = SEVERITY_MAP[item.riskCategory] || 'Low';
    const title    = `DCSA Self-Inspection Finding: ${item.itemCode || item.questionText.slice(0, 40)}`;

    const weakness = [
      `Campaign: ${campaign.name}`,
      `Section: ${item.section?.sectionCode ? item.section.sectionCode + ' · ' : ''}${item.section?.title || ''}`,
      item.nispomRef ? `NISPOM Ref: ${item.nispomRef}` : null,
      '',
      item.questionText,
      item.workNotes ? `\nWork Notes: ${item.workNotes}` : null,
    ].filter(l => l !== null).join('\n');

    const last    = await db.poam.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const lastNum = last ? parseInt(last.id.replace('POA-', '')) || 0 : 0;
    const poamId  = 'POA-' + String(lastNum + 1).padStart(3, '0');

    const poam = await db.poam.create({
      data: {
        id: poamId, title, siteId: campaign.siteId,
        severity, status: 'Open',
        weakness,
        sourceType:    'InspectionCampaignItem',
        sourceId:      item.id,
        identifiedDate: new Date().toISOString().split('T')[0],
      },
    });

    await db.inspectionCampaignItem.update({
      where: { id: item.id },
      data: { poamId: poam.id, updatedBy: actor(req) },
    });

    await audit(actor(req), 'CAMPAIGN_ITEM_POAM_CREATE', poam.id,
      `Linked POA&M "${title}" from campaign item ${item.id}`, campaign.siteId);

    res.status(201).json({ poamId: poam.id, poam });
  } catch (err) { next(err); }
});

// ── Get campaign item links ────────────────────────────────────────────────
router.get('/campaign-items/:id/links', async (req, res, next) => {
  try {
    const item = await db.inspectionCampaignItem.findUnique({
      where: { id: req.params.id },
      select: { taskId: true, poamId: true, campaignId: true },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const campaign = await db.inspectionCampaign.findUnique({
      where: { id: item.campaignId }, select: { siteId: true },
    });
    if (!req.assertTenantDocument(campaign)) return res.status(403).json({ error: 'Forbidden' });

    res.json({ taskId: item.taskId || null, poamId: item.poamId || null });
  } catch (err) { next(err); }
});

module.exports = router;
