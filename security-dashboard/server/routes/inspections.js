'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const { db } = require('../../../packages/db/src');
const { resolveTenantScope, assertSiteAccess, resolveWriteSiteId, buildSiteWhere } = require('../../lib/tenantScope');

const router = express.Router();

const DEFAULT_TEMPLATE_NAME = 'DCSA Self-Inspection Handbook - NISP Contractor (Adapted)';
const DEFAULT_TEMPLATE_VERSION = 'v7 (Feb 2022)';
const DEFAULT_TEMPLATE_SOURCE = 'DCSA Self-Inspection Handbook for NISP Contractors';
const DEFAULT_TEMPLATE_SECTIONS = [
  {
    code: '117.07',
    title: 'Procedures',
    description: 'Security procedures, local implementation, and self-inspection governance aligned to 32 CFR Part 117.07.',
    items: [
      { code: '7.001', ref: '32 CFR 117.07', question: 'Has the facility documented and implemented current security procedures covering classified involvement and local operating practices?', risk: 'Procedures', evidenceRequired: true },
      { code: '7.002', ref: '32 CFR 117.07', question: 'Does the self-inspection process review applicable records, people, and observed behaviors instead of relying only on paperwork?', risk: 'Self-Inspection Program', evidenceRequired: false },
      { code: '7.003', ref: '32 CFR 117.07', question: 'Are vulnerabilities, lessons learned, and recurring issues captured and fed back into site procedures?', risk: 'Continuous Improvement', evidenceRequired: false },
    ],
  },
  {
    code: '117.08',
    title: 'Reporting Requirements',
    description: 'Adverse information, foreign travel/contact, suspicious contact, and security incident reporting aligned to 32 CFR Part 117.08.',
    items: [
      { code: '8.001', ref: '32 CFR 117.08', question: 'Are reportable events identified, documented, and submitted within required timelines?', risk: 'Reporting', evidenceRequired: true },
      { code: '8.002', ref: '32 CFR 117.08', question: 'Do personnel understand how to report suspicious contact, foreign travel, and adverse information?', risk: 'Security Awareness', evidenceRequired: false },
      { code: '8.003', ref: '32 CFR 117.08', question: 'Are incidents and required notifications tracked through resolution with management visibility?', risk: 'Incident Management', evidenceRequired: true },
    ],
  },
  {
    code: '117.10',
    title: 'Eligibility for Access to Classified Information',
    description: 'Personnel eligibility, indoctrination, need-to-know, and access roster controls aligned to 32 CFR Part 117.10.',
    items: [
      { code: '10.001', ref: '32 CFR 117.10', question: 'Do access rosters reflect only currently eligible and indoctrinated personnel with valid need-to-know?', risk: 'Personnel Security', evidenceRequired: true },
      { code: '10.002', ref: '32 CFR 117.10', question: 'Are visit, access, and indoctrination decisions supported by current eligibility and briefing records?', risk: 'Access Control', evidenceRequired: true },
      { code: '10.003', ref: '32 CFR 117.10', question: 'Are access removals, debriefings, and roster updates performed promptly when duties or eligibility change?', risk: 'Personnel Changes', evidenceRequired: false },
    ],
  },
  {
    code: '117.12',
    title: 'Security Training and Briefings',
    description: 'Initial, refresher, insider threat, and special briefings aligned to 32 CFR Part 117.12.',
    items: [
      { code: '12.001', ref: '32 CFR 117.12', question: 'Are initial and refresher security briefings completed and documented for all cleared personnel?', risk: 'Training', evidenceRequired: true },
      { code: '12.002', ref: '32 CFR 117.12', question: 'Are insider threat, derivative classification, and specialized briefings provided when applicable?', risk: 'Training', evidenceRequired: false },
      { code: '12.003', ref: '32 CFR 117.12', question: 'Can personnel explain current reporting expectations and safeguarding responsibilities during interview sampling?', risk: 'Awareness Validation', evidenceRequired: false },
    ],
  },
  {
    code: '117.13',
    title: 'Classification, Marking, Safeguarding, and Material Control',
    description: 'Classification handling, storage, document accountability, and media control aligned to 32 CFR Part 117.13.',
    items: [
      { code: '13.001', ref: '32 CFR 117.13', question: 'Are classified documents and media properly marked, controlled, and reconciled to local accountability records?', risk: 'Material Control', evidenceRequired: true },
      { code: '13.002', ref: '32 CFR 117.13', question: 'Are approved storage, end-of-day checks, and open-storage / closed-area protections operating as intended?', risk: 'Safeguarding', evidenceRequired: true },
      { code: '13.003', ref: '32 CFR 117.13', question: 'Are destruction, transfer, receipt, and dispatch actions documented completely and reviewed for anomalies?', risk: 'Lifecycle Control', evidenceRequired: true },
    ],
  },
  {
    code: '117.16',
    title: 'Visits and Meetings',
    description: 'Classified visits, meetings, escorting, and visitor control aligned to 32 CFR Part 117.16.',
    items: [
      { code: '16.001', ref: '32 CFR 117.16', question: 'Are classified visits and meetings justified, approved, and limited to authorized personnel with valid need-to-know?', risk: 'Visitor Control', evidenceRequired: true },
      { code: '16.002', ref: '32 CFR 117.16', question: 'Are visitor rosters, badges, escorts, and meeting records complete and retained per local process?', risk: 'Visitor Accountability', evidenceRequired: true },
      { code: '16.003', ref: '32 CFR 117.16', question: 'Do observed visitor handling practices match documented escort and safeguarding procedures?', risk: 'Operational Compliance', evidenceRequired: false },
    ],
  },
];

function ensureSiteAccess(req, siteId) {
  if (!assertSiteAccess(req.user, siteId)) {
    const err = new Error(`Site access denied: ${siteId}`);
    err.status = 403;
    throw err;
  }
}

async function ensureDefaultTemplate() {
  const existing = await db.checklistTemplate.findFirst({
    where: { name: DEFAULT_TEMPLATE_NAME, isActive: true },
    include: { sections: { include: { items: true }, orderBy: { sortOrder: 'asc' } } },
  });
  if (existing) return existing;

  return db.checklistTemplate.create({
    data: {
      name: DEFAULT_TEMPLATE_NAME,
      source: DEFAULT_TEMPLATE_SOURCE,
      version: DEFAULT_TEMPLATE_VERSION,
      description: 'DCSA self-inspection handbook aligned template for NISP contractor facility reviews, adapted into Sentinel campaign workflow.',
      isActive: true,
      sections: {
        create: DEFAULT_TEMPLATE_SECTIONS.map((section, sectionIndex) => ({
          sectionCode: section.code,
          title: section.title,
          description: section.description,
          sortOrder: sectionIndex,
          items: {
            create: section.items.map((item, itemIndex) => ({
              itemCode: item.code,
              nispomRef: item.ref,
              controlRef: item.ref,
              questionText: item.question,
              riskCategory: item.risk,
              evidenceRequired: Boolean(item.evidenceRequired),
              sortOrder: itemIndex,
            })),
          },
        })),
      },
    },
    include: { sections: { include: { items: true }, orderBy: { sortOrder: 'asc' } } },
  });
}

async function attachTemplateToCampaign(campaignId, template) {
  for (const section of template.sections) {
    const createdSection = await db.inspectionCampaignSection.create({
      data: {
        id: randomUUID(),
        campaignId,
        templateSectionId: section.id,
        sectionCode: section.sectionCode,
        title: section.title,
        sortOrder: section.sortOrder,
        status: 'Not Started',
        summary: section.description || null,
      },
    });

    if (section.items?.length) {
      await db.inspectionCampaignItem.createMany({
        data: section.items.map(item => ({
          id: randomUUID(),
          campaignId,
          sectionId: createdSection.id,
          templateItemId: item.id,
          itemCode: item.itemCode,
          requirementRef: item.controlRef || item.nispomRef,
          nispomRef: item.nispomRef,
          questionText: item.questionText,
          applicabilityNote: item.applicabilityNote,
          riskCategory: item.riskCategory,
          evidenceRequired: item.evidenceRequired,
          controlRef: item.controlRef,
          sortOrder: item.sortOrder,
          status: 'Not Started',
        })),
      });
    }
  }
}

async function refreshSectionAndCampaignState(campaignId, sectionId) {
  const items = await db.inspectionCampaignItem.findMany({
    where: { campaignId, sectionId },
    select: { result: true },
  });

  const total = items.length;
  const reviewed = items.filter(item => item.result).length;
  const compliant = items.filter(item => item.result === 'Compliant' || item.result === 'N/A').length;
  const nonCompliant = items.filter(item => item.result === 'Non-Compliant' || item.result === 'Observation').length;

  const sectionStatus =
    reviewed === 0 ? 'Not Started' :
    reviewed < total ? 'In Progress' :
    nonCompliant > 0 ? 'Completed With Findings' :
    'Completed';

  const scorePercent = total > 0 ? Math.round((compliant / total) * 100) : null;

  await db.inspectionCampaignSection.update({
    where: { id: sectionId },
    data: {
      status: sectionStatus,
      scorePercent,
      completedAt: reviewed === total && total > 0 ? new Date() : null,
      updatedAt: new Date(),
    },
  });

  const campaignItems = await db.inspectionCampaignItem.findMany({
    where: { campaignId },
    select: { result: true },
  });

  const totalCampaignItems = campaignItems.length;
  const reviewedCampaignItems = campaignItems.filter(item => item.result).length;
  const campaignStatus =
    reviewedCampaignItems === 0 ? 'Draft' :
    reviewedCampaignItems < totalCampaignItems ? 'In Progress' :
    'Completed';

  await db.inspectionCampaign.update({
    where: { id: campaignId },
    data: {
      status: campaignStatus,
      updatedAt: new Date(),
    },
  });
}

async function buildCampaignSummary(campaignId) {
  const campaign = await db.inspectionCampaign.findUnique({
    where: { id: campaignId },
    include: {
      sections: {
        include: {
          items: true,
        },
      },
      findings: {
        include: {
          correctiveActions: true,
        },
      },
    },
  });

  if (!campaign) return null;

  const totalItems = campaign.sections.reduce((sum, s) => sum + s.items.length, 0);
  const reviewedItems = campaign.sections.reduce(
    (sum, s) => sum + s.items.filter(i => i.status !== 'Not Started').length,
    0
  );
  const openFindings = campaign.findings.filter(f => f.status === 'Open').length;
  const overdueActions = campaign.findings.reduce(
    (sum, f) => sum + f.correctiveActions.filter(a => a.status !== 'Closed' && a.targetDate && a.targetDate < new Date()).length,
    0
  );

  return {
    campaign,
    summary: {
      totalItems,
      reviewedItems,
      openFindings,
      overdueActions,
    },
  };
}

// ─── Campaign Routes ─────────────────────────────────────────────────────────

/**
 * POST /api/inspection-campaigns
 * Create a new inspection campaign
 */
router.post('/inspection-campaigns', async (req, res) => {
  try {
    const { name, inspectionType, facilityArea, standard, leadInspector, startDate, targetDate, notes, templateId } = req.body;
    const siteId = resolveWriteSiteId(req);

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }

    ensureSiteAccess(req, siteId);
    const template = templateId
      ? await db.checklistTemplate.findUnique({
          where: { id: templateId },
          include: { sections: { include: { items: true }, orderBy: { sortOrder: 'asc' } } },
        })
      : await ensureDefaultTemplate();

    // Create campaign
    const campaign = await db.inspectionCampaign.create({
      data: {
        id: randomUUID(),
        siteId,
        name,
        inspectionType,
        facilityArea,
        standard,
        leadInspector,
        startDate: startDate ? new Date(startDate) : null,
        targetDate: targetDate ? new Date(targetDate) : null,
        notes,
        templateId: template?.id || templateId || null,
        templateName: template?.name || 'Default',
        templateVersion: template?.version || null,
        status: 'Draft',
        createdBy: req.user?.username || 'system',
      },
    });

    if (template?.sections?.length) {
      await attachTemplateToCampaign(campaign.id, template);
    }

    return res.status(201).json(campaign);
  } catch (err) {
    console.error('Error creating campaign:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

/**
 * GET /api/inspection-campaigns
 * List campaigns for current tenant scope
 */
router.get('/inspection-campaigns', async (req, res) => {
  try {
    const scope = resolveTenantScope(req);
    const { siteId, status } = req.query;

    let filter = buildSiteWhere(scope);
    if (siteId) {
      ensureSiteAccess(req, siteId);
      filter = buildSiteWhere({ mode: 'single', siteId });
    }
    if (status) {
      filter.status = status;
    }

    const campaigns = await db.inspectionCampaign.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });

    return res.json(campaigns);
  } catch (err) {
    console.error('Error listing campaigns:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

/**
 * GET /api/inspection-campaigns/:id
 * Get campaign with sections, items, and findings
 */
router.get('/inspection-campaigns/:id', async (req, res) => {
  try {
    const campaign = await db.inspectionCampaign.findUnique({
      where: { id: req.params.id },
      include: {
        sections: {
          include: {
            items: {
              include: { findings: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        findings: { include: { correctiveActions: true } },
      },
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Check access
    ensureSiteAccess(req, campaign.siteId);

    const totalItems = campaign.sections.reduce((sum, s) => sum + s.items.length, 0);
    const reviewedItems = campaign.sections.reduce(
      (sum, s) => sum + s.items.filter(i => i.status !== 'Not Started').length,
      0
    );
    const openFindings = campaign.findings.filter(f => f.status === 'Open').length;
    const overdueActions = campaign.findings.reduce(
      (sum, f) => sum + f.correctiveActions.filter(a => a.status !== 'Closed' && a.targetDate && a.targetDate < new Date()).length,
      0
    );

    return res.json({
      campaign,
      summary: {
        totalItems,
        reviewedItems,
        openFindings,
        overdueActions,
      },
    });
  } catch (err) {
    console.error('Error fetching campaign:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

/**
 * PATCH /api/inspection-campaigns/:id
 * Update campaign metadata/status/rating
 */
router.patch('/inspection-campaigns/:id', async (req, res) => {
  try {
    const campaign = await db.inspectionCampaign.findUnique({ where: { id: req.params.id } });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    ensureSiteAccess(req, campaign.siteId);

    const updated = await db.inspectionCampaign.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name ?? campaign.name,
        inspectionType: req.body.inspectionType ?? campaign.inspectionType,
        facilityArea: req.body.facilityArea ?? campaign.facilityArea,
        standard: req.body.standard ?? campaign.standard,
        overallRating: req.body.overallRating ?? campaign.overallRating,
        leadInspector: req.body.leadInspector ?? campaign.leadInspector,
        status: req.body.status ?? campaign.status,
        completedAt: req.body.completedAt ? new Date(req.body.completedAt) : campaign.completedAt,
        notes: req.body.notes ?? campaign.notes,
        updatedAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error('Error updating campaign:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

/**
 * POST /api/inspection-campaigns/:id/bootstrap
 * Attach a baseline checklist to an existing campaign that has no sections yet
 */
router.post('/inspection-campaigns/:id/bootstrap', async (req, res) => {
  try {
    const campaign = await db.inspectionCampaign.findUnique({
      where: { id: req.params.id },
      include: { sections: true },
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    ensureSiteAccess(req, campaign.siteId);

    if (campaign.sections.length > 0) {
      return res.status(400).json({ message: 'Campaign already has checklist sections' });
    }

    const template = await ensureDefaultTemplate();
    await attachTemplateToCampaign(campaign.id, template);

    const hydrated = await db.inspectionCampaign.findUnique({
      where: { id: campaign.id },
      include: {
        sections: {
          include: { items: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return res.json(hydrated);
  } catch (err) {
    console.error('Error bootstrapping campaign checklist:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

/**
 * DELETE /api/inspection-campaigns/:id
 * Delete a campaign and its related checklist/findings/actions
 */
router.delete('/inspection-campaigns/:id', async (req, res) => {
  try {
    const campaign = await db.inspectionCampaign.findUnique({ where: { id: req.params.id } });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    ensureSiteAccess(req, campaign.siteId);

    await db.inspectionCampaign.delete({
      where: { id: req.params.id },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting campaign:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

// ─── Checklist Item Routes ──────────────────────────────────────────────────────

/**
 * PATCH /api/inspection-campaigns/:id/items/:itemId
 * Update checklist item result, severity, notes
 */
router.patch('/inspection-campaigns/:id/items/:itemId', async (req, res) => {
  try {
    const { result, severity, evidenceNotes, inspectorComment } = req.body;

    // Verify campaign access
    const campaign = await db.inspectionCampaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    ensureSiteAccess(req, campaign.siteId);

    const existingItem = await db.inspectionCampaignItem.findUnique({
      where: { id: req.params.itemId },
      select: { id: true, campaignId: true },
    });
    if (!existingItem || existingItem.campaignId !== campaign.id) {
      return res.status(404).json({ message: 'Campaign item not found for this campaign' });
    }

    const item = await db.inspectionCampaignItem.update({
      where: { id: req.params.itemId },
      data: {
        result: result ?? undefined,
        severity: severity ?? undefined,
        evidenceNotes: evidenceNotes ?? undefined,
        inspectorComment: inspectorComment ?? undefined,
        status: result ? 'Completed' : 'Not Started',
        updatedBy: req.user?.username,
        statusUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await refreshSectionAndCampaignState(campaign.id, item.sectionId);
    const fresh = await buildCampaignSummary(campaign.id);

    return res.json({
      item,
      campaign: fresh?.campaign || null,
      summary: fresh?.summary || null,
    });
  } catch (err) {
    console.error('Error updating item:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

// ─── Finding Routes ─────────────────────────────────────────────────────────────

/**
 * POST /api/inspection-findings
 * Create a finding from a checklist item
 */
router.post('/inspection-findings', async (req, res) => {
  try {
    const { campaignId, itemId, title, description, requirementRef, severity, responsibleOrg, responsibleUser, dueDate } = req.body;

    if (!campaignId || !itemId || !title) {
      return res.status(400).json({ message: 'campaignId, itemId, and title are required' });
    }

    // Verify campaign access
    const campaign = await db.inspectionCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    ensureSiteAccess(req, campaign.siteId);

    const item = await db.inspectionCampaignItem.findUnique({
      where: { id: itemId },
      select: { id: true, campaignId: true },
    });
    if (!item || item.campaignId !== campaign.id) {
      return res.status(404).json({ message: 'Campaign item not found for this campaign' });
    }

    const finding = await db.inspectionFinding.create({
      data: {
        id: randomUUID(),
        campaignId,
        itemId,
        title,
        description,
        requirementRef,
        severity: severity || 'Medium',
        responsibleOrg,
        responsibleUser,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'Open',
      },
    });

    return res.status(201).json(finding);
  } catch (err) {
    console.error('Error creating finding:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

/**
 * PATCH /api/inspection-findings/:id
 * Update finding
 */
router.patch('/inspection-findings/:id', async (req, res) => {
  try {
    const finding = await db.inspectionFinding.findUnique({ where: { id: req.params.id } });

    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    // Verify campaign access
    const campaign = await db.inspectionCampaign.findUnique({ where: { id: finding.campaignId } });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    ensureSiteAccess(req, campaign.siteId);

    const updated = await db.inspectionFinding.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title ?? finding.title,
        description: req.body.description ?? finding.description,
        severity: req.body.severity ?? finding.severity,
        status: req.body.status ?? finding.status,
        responsibleOrg: req.body.responsibleOrg ?? finding.responsibleOrg,
        responsibleUser: req.body.responsibleUser ?? finding.responsibleUser,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : finding.dueDate,
        closedDate: req.body.closedDate ? new Date(req.body.closedDate) : finding.closedDate,
        rootCause: req.body.rootCause ?? finding.rootCause,
        notes: req.body.notes ?? finding.notes,
        updatedAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error('Error updating finding:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

// ─── Corrective Action Routes ────────────────────────────────────────────────────

/**
 * POST /api/inspection-corrective-actions
 * Create a corrective action
 */
router.post('/inspection-corrective-actions', async (req, res) => {
  try {
    const { findingId, actionText, assignedTo, assignedOrg, targetDate } = req.body;

    if (!findingId || !actionText) {
      return res.status(400).json({ message: 'findingId and actionText are required' });
    }

    // Verify access via finding -> campaign
    const finding = await db.inspectionFinding.findUnique({ where: { id: findingId } });
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }

    const campaign = await db.inspectionCampaign.findUnique({ where: { id: finding.campaignId } });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    ensureSiteAccess(req, campaign.siteId);

    const action = await db.inspectionCorrectiveAction.create({
      data: {
        id: randomUUID(),
        findingId,
        actionText,
        assignedTo,
        assignedOrg,
        targetDate: targetDate ? new Date(targetDate) : null,
        status: 'Open',
      },
    });

    return res.status(201).json(action);
  } catch (err) {
    console.error('Error creating corrective action:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

/**
 * PATCH /api/inspection-corrective-actions/:id
 * Update corrective action
 */
router.patch('/inspection-corrective-actions/:id', async (req, res) => {
  try {
    const action = await db.inspectionCorrectiveAction.findUnique({ where: { id: req.params.id } });

    if (!action) {
      return res.status(404).json({ message: 'Corrective action not found' });
    }

    // Verify access via finding -> campaign
    const finding = await db.inspectionFinding.findUnique({ where: { id: action.findingId } });
    if (!finding) {
      return res.status(404).json({ message: 'Finding not found' });
    }
    const campaign = await db.inspectionCampaign.findUnique({ where: { id: finding.campaignId } });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    ensureSiteAccess(req, campaign.siteId);

    const updated = await db.inspectionCorrectiveAction.update({
      where: { id: req.params.id },
      data: {
        actionText: req.body.actionText ?? action.actionText,
        status: req.body.status ?? action.status,
        assignedTo: req.body.assignedTo ?? action.assignedTo,
        assignedOrg: req.body.assignedOrg ?? action.assignedOrg,
        targetDate: req.body.targetDate ? new Date(req.body.targetDate) : action.targetDate,
        completedDate: req.body.completedDate ? new Date(req.body.completedDate) : action.completedDate,
        verificationBy: req.body.verificationBy ?? action.verificationBy,
        verificationNotes: req.body.verificationNotes ?? action.verificationNotes,
        updatedAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error('Error updating corrective action:', err);
    return res.status(err.status || 500).json({ _wsError: true, message: err.message });
  }
});

module.exports = router;
