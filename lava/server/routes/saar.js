'use strict';

const router      = require('express').Router();
const { db }      = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { writeAudit, actor } = require('../audit');
const { requireVulcan } = require('../authz');
const { provisionScorvaFromSaar } = require('../../../packages/db/src/scorvaProvisioning');

const DAY_MS = 1000 * 60 * 60 * 24;

const isExpired = (dateStr) => {
  if (!dateStr) return true;
  const then   = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return then < cutoff;
};

const plusDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const trainingExpiresAt = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  date.setFullYear(date.getFullYear() + 1);
  return date;
};

const ageInDays = (createdAt) => Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS);

const serializeSaar = (saar) => {
  const annualTrainingExpires = trainingExpiresAt(saar.annualTrainingDate);
  const derivativeTrainingExpires = trainingExpiresAt(saar.derivativeTrainingDate);
  return Object.assign({}, saar, {
    annualTrainingExpiresAt: annualTrainingExpires,
    derivativeTrainingExpiresAt: derivativeTrainingExpires,
    trainingExpired: !annualTrainingExpires || !derivativeTrainingExpires || annualTrainingExpires < new Date() || derivativeTrainingExpires < new Date(),
    pendingAgeDays: saar.createdAt ? ageInDays(saar.createdAt) : 0,
  });
};

// ── Submit SAAR (public — no auth required) ──────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      lastName, firstName, middleInitial, rankGrade,
      organization, officeSymbol, phone, email,
      supervisorName, supervisorPhone, supervisorEmail,
      systemName, systemOwner, classification, purposeOfAccess,
      accessType, privilegedJustification, privilegedAccessType,
      annualTrainingDate, derivativeTrainingDate,
      agreementSigned, agreementSignedAt,
    } = req.body;

    if (!lastName || !firstName || !organization || !email || !systemName) {
      return res.status(400).json({ error: 'Missing required fields: lastName, firstName, organization, email, systemName' });
    }

    if (isExpired(annualTrainingDate)) {
      return res.status(422).json({ error: 'Annual IA Training date is expired or missing. Training must have been completed within the last 365 days.' });
    }
    if (isExpired(derivativeTrainingDate)) {
      return res.status(422).json({ error: 'Derivative Classification Training date is expired or missing. Training must have been completed within the last 365 days.' });
    }

    const saar = await db.lavaSaar.create({
      data: {
        lastName,
        firstName,
        middleInitial:          middleInitial         || null,
        rankGrade:              rankGrade             || null,
        organization,
        officeSymbol:           officeSymbol          || null,
        phone:                  phone                 || null,
        email,
        supervisorName:         supervisorName        || null,
        supervisorPhone:        supervisorPhone       || null,
        supervisorEmail:        supervisorEmail       || null,
        systemName,
        systemOwner:            systemOwner           || null,
        classification:         classification        || 'UNCLASSIFIED',
        purposeOfAccess:        purposeOfAccess       || null,
        accessType:             accessType            || 'standard',
        privilegedJustification: accessType === 'privileged' ? (privilegedJustification || null) : null,
        privilegedAccessType:   accessType === 'privileged' ? (privilegedAccessType   || null) : null,
        annualTrainingDate:     annualTrainingDate     ? new Date(annualTrainingDate)     : null,
        derivativeTrainingDate: derivativeTrainingDate ? new Date(derivativeTrainingDate) : null,
        agreementSigned:        Boolean(agreementSigned),
        agreementSignedAt:      agreementSigned ? new Date(agreementSignedAt || Date.now()) : null,
        status:                 'pending',
      },
    });

    await writeAudit(
      req,
      'submit',
      'saar',
      saar.id,
      `SAAR submitted for ${saar.systemName} by ${saar.firstName} ${saar.lastName}`,
      saar.siteId
    );

    res.status(201).json({ id: saar.id, message: 'SAAR submitted successfully. A Vulcan administrator will review your request.' });
  } catch (err) {
    console.error('[LAVA/saar] submit error', err);
    res.status(500).json({ error: 'Failed to submit SAAR' });
  }
});

// ── List all SAARs (Vulcan Command) ─────────────────────────────────────────
router.get('/', requireAuth, requireVulcan, async (req, res) => {
  try {
    const { status } = req.query;
    const saars = await db.lavaSaar.findMany({
      where:   status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
    res.json(saars.map(serializeSaar));
  } catch (err) {
    console.error('[LAVA/saar] list error', err);
    res.status(500).json({ error: 'Failed to fetch SAARs' });
  }
});

// ── Get single SAAR ──────────────────────────────────────────────────────────
router.get('/:id', requireAuth, requireVulcan, async (req, res) => {
  try {
    const saar = await db.lavaSaar.findUnique({ where: { id: req.params.id } });
    if (!saar) return res.status(404).json({ error: 'SAAR not found' });
    res.json(serializeSaar(saar));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SAAR' });
  }
});

// ── Approve / Reject (Vulcan Command) ───────────────────────────────────────
router.patch('/:id/status', requireAuth, requireVulcan, async (req, res) => {
  try {
    const { status, rejectionReason, reviewerComment } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const saar = await db.lavaSaar.update({
      where: { id: req.params.id },
      data: {
        status,
        rejectionReason: status === 'rejected' ? (rejectionReason || null) : null,
        reviewerComment: reviewerComment ? reviewerComment.trim() : null,
        reviewedBy:      actor(req),
      },
    });

    await writeAudit(
      req,
      status,
      'saar',
      saar.id,
      status === 'rejected'
        ? `Rejected SAAR for ${saar.email}. Reason: ${rejectionReason || 'Not provided'}`
        : `Approved SAAR for ${saar.email}`,
      saar.siteId
    );

    res.json(serializeSaar(saar));
  } catch (err) {
    console.error('[LAVA/saar] status update error', err);
    res.status(500).json({ error: 'Failed to update SAAR status' });
  }
});

// ── Mark as Provisioned + Hardware Hand-off ──────────────────────────────────
router.patch('/:id/provision', requireAuth, requireVulcan, async (req, res) => {
  try {
    const { yubiKeySerial, tokenType, provisioningNotes, accessExpiresAt, revalidationDueAt } = req.body;
    if (!yubiKeySerial) return res.status(400).json({ error: 'YubiKey/Token serial number is required for provisioning' });

    const saar = await db.lavaSaar.update({
      where: { id: req.params.id },
      data: {
        status:            'provisioned',
        yubiKeySerial:     yubiKeySerial.trim(),
        tokenType:         tokenType || 'YubiKey',
        provisioningNotes: provisioningNotes ? provisioningNotes.trim() : null,
        accessExpiresAt:   accessExpiresAt ? new Date(accessExpiresAt) : plusDays(365),
        revalidationDueAt: revalidationDueAt ? new Date(revalidationDueAt) : plusDays(365),
        revokedAt:         null,
        revokedBy:         null,
        revocationReason:  null,
        provisionedBy:     actor(req),
      },
    });
    const scorvaProvisioning = await provisionScorvaFromSaar(saar, { actor: actor(req) });

    await writeAudit(
      req,
      'provision',
      'saar',
      saar.id,
      `Provisioned ${saar.email} with ${saar.tokenType || 'token'} ${saar.yubiKeySerial}; SCORVA ${scorvaProvisioning.created ? 'user created' : 'user updated'} for ${scorvaProvisioning.user.username}`,
      saar.siteId
    );

    res.json(Object.assign({}, serializeSaar(saar), {
      scorvaProvisioning: {
        userId: scorvaProvisioning.user.id,
        username: scorvaProvisioning.user.username,
        created: scorvaProvisioning.created,
        yubiKeySerial: scorvaProvisioning.yubiKey ? scorvaProvisioning.yubiKey.serial : null,
      },
    }));
  } catch (err) {
    console.error('[LAVA/saar] provision error', err);
    res.status(500).json({ error: 'Failed to provision account' });
  }
});

router.patch('/:id/lifecycle', requireAuth, requireVulcan, async (req, res) => {
  try {
    const { action, reason, accessExpiresAt, revalidationDueAt } = req.body;
    if (!['revalidate', 'suspend', 'revoke'].includes(action)) {
      return res.status(400).json({ error: 'Invalid lifecycle action' });
    }

    const current = await db.lavaSaar.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'SAAR not found' });

    const updates = {};
    if (action === 'revalidate') {
      updates.status = 'provisioned';
      updates.revalidationDueAt = revalidationDueAt ? new Date(revalidationDueAt) : plusDays(365);
      updates.accessExpiresAt = accessExpiresAt ? new Date(accessExpiresAt) : (current.accessExpiresAt || plusDays(365));
      updates.revokedAt = null;
      updates.revokedBy = null;
      updates.revocationReason = null;
      updates.reviewedBy = actor(req);
    }
    if (action === 'suspend') {
      updates.status = 'suspended';
      updates.reviewedBy = actor(req);
    }
    if (action === 'revoke') {
      updates.status = 'revoked';
      updates.revokedAt = new Date();
      updates.revokedBy = actor(req);
      updates.revocationReason = reason ? reason.trim() : null;
    }

    const saar = await db.lavaSaar.update({
      where: { id: req.params.id },
      data: updates,
    });

    await writeAudit(
      req,
      action,
      'saar',
      saar.id,
      action === 'revalidate'
        ? `Revalidated access for ${saar.email}`
        : `${action}d access for ${saar.email}${reason ? `: ${reason}` : ''}`,
      saar.siteId
    );

    res.json(serializeSaar(saar));
  } catch (err) {
    console.error('[LAVA/saar] lifecycle error', err);
    res.status(500).json({ error: 'Failed to update access lifecycle' });
  }
});

// ── SAAR stats for dashboard ─────────────────────────────────────────────────
router.get('/meta/stats', requireAuth, requireVulcan, async (req, res) => {
  try {
    const [pending, approved, rejected, provisioned, suspended, revoked, total, pendingSaars, approvedWait, lifecycleSaars] = await Promise.all([
      db.lavaSaar.count({ where: { status: 'pending'     } }),
      db.lavaSaar.count({ where: { status: 'approved'    } }),
      db.lavaSaar.count({ where: { status: 'rejected'    } }),
      db.lavaSaar.count({ where: { status: 'provisioned' } }),
      db.lavaSaar.count({ where: { status: 'suspended'   } }),
      db.lavaSaar.count({ where: { status: 'revoked'     } }),
      db.lavaSaar.count(),
      db.lavaSaar.findMany({
        where: { status: 'pending' },
        select: { createdAt: true },
      }),
      db.lavaSaar.count({ where: { status: 'approved' } }),
      db.lavaSaar.findMany({
        where: { status: { in: ['provisioned', 'suspended'] } },
        select: { annualTrainingDate: true, derivativeTrainingDate: true, revalidationDueAt: true },
      }),
    ]);
    const pendingOver7 = pendingSaars.filter((row) => ageInDays(row.createdAt) >= 7).length;
    const pendingOver14 = pendingSaars.filter((row) => ageInDays(row.createdAt) >= 14).length;
    const pendingOver30 = pendingSaars.filter((row) => ageInDays(row.createdAt) >= 30).length;
    const now = new Date();
    const plusThirty = plusDays(30);
    const expiringTraining30 = lifecycleSaars.filter((row) => {
      const annual = trainingExpiresAt(row.annualTrainingDate);
      const derivative = trainingExpiresAt(row.derivativeTrainingDate);
      return [annual, derivative].some((date) => date && date >= now && date <= plusThirty);
    }).length;
    const expiredTraining = lifecycleSaars.filter((row) => {
      const annual = trainingExpiresAt(row.annualTrainingDate);
      const derivative = trainingExpiresAt(row.derivativeTrainingDate);
      return !annual || !derivative || annual < now || derivative < now;
    }).length;
    const revalidationDue = lifecycleSaars.filter((row) => row.revalidationDueAt && new Date(row.revalidationDueAt) >= now && new Date(row.revalidationDueAt) <= plusThirty).length;
    const revalidationOverdue = lifecycleSaars.filter((row) => row.revalidationDueAt && new Date(row.revalidationDueAt) < now).length;
    res.json({
      pending, approved, rejected, provisioned, suspended, revoked, total,
      pendingOver7, pendingOver14, pendingOver30,
      approvedNotProvisioned: approvedWait,
      expiringTraining30,
      expiredTraining,
      revalidationDue,
      revalidationOverdue,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
