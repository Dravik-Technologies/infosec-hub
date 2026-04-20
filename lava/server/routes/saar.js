'use strict';

const router      = require('express').Router();
const { db }      = require('../db');
const requireAuth = require('../middleware/requireAuth');

const isExpired = (dateStr) => {
  if (!dateStr) return true;
  const then   = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return then < cutoff;
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

    res.status(201).json({ id: saar.id, message: 'SAAR submitted successfully. A Vulcan administrator will review your request.' });
  } catch (err) {
    console.error('[LAVA/saar] submit error', err);
    res.status(500).json({ error: 'Failed to submit SAAR' });
  }
});

// ── List all SAARs (Vulcan Command) ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const saars = await db.lavaSaar.findMany({
      where:   status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
    res.json(saars);
  } catch (err) {
    console.error('[LAVA/saar] list error', err);
    res.status(500).json({ error: 'Failed to fetch SAARs' });
  }
});

// ── Get single SAAR ──────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const saar = await db.lavaSaar.findUnique({ where: { id: req.params.id } });
    if (!saar) return res.status(404).json({ error: 'SAAR not found' });
    res.json(saar);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SAAR' });
  }
});

// ── Approve / Reject (Vulcan Command) ───────────────────────────────────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const saar = await db.lavaSaar.update({
      where: { id: req.params.id },
      data: {
        status,
        rejectionReason: status === 'rejected' ? (rejectionReason || null) : null,
        reviewedBy:      req.session.user?.username || null,
      },
    });

    res.json(saar);
  } catch (err) {
    console.error('[LAVA/saar] status update error', err);
    res.status(500).json({ error: 'Failed to update SAAR status' });
  }
});

// ── Mark as Provisioned + Hardware Hand-off ──────────────────────────────────
router.patch('/:id/provision', requireAuth, async (req, res) => {
  try {
    const { yubiKeySerial, tokenType } = req.body;
    if (!yubiKeySerial) return res.status(400).json({ error: 'YubiKey/Token serial number is required for provisioning' });

    const saar = await db.lavaSaar.update({
      where: { id: req.params.id },
      data: {
        status:        'provisioned',
        yubiKeySerial: yubiKeySerial.trim(),
        tokenType:     tokenType || 'YubiKey',
        provisionedBy: req.session.user?.username || null,
      },
    });

    res.json(saar);
  } catch (err) {
    console.error('[LAVA/saar] provision error', err);
    res.status(500).json({ error: 'Failed to provision account' });
  }
});

// ── SAAR stats for dashboard ─────────────────────────────────────────────────
router.get('/meta/stats', requireAuth, async (req, res) => {
  try {
    const [pending, approved, rejected, provisioned, total] = await Promise.all([
      db.lavaSaar.count({ where: { status: 'pending'     } }),
      db.lavaSaar.count({ where: { status: 'approved'    } }),
      db.lavaSaar.count({ where: { status: 'rejected'    } }),
      db.lavaSaar.count({ where: { status: 'provisioned' } }),
      db.lavaSaar.count(),
    ]);
    res.json({ pending, approved, rejected, provisioned, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
