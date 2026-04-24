'use strict';

const router = require('express').Router();
const { db } = require('../db');
const { actor, writeAudit } = require('../audit');
const { requireVulcan } = require('../authz');

router.get('/', async (req, res) => {
  try {
    const systems = await db.lavaSystemRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { assets: true },
    });
    res.json(systems);
  } catch (err) {
    console.error('[LAVA/systems] list error', err);
    res.status(500).json({ error: 'Failed to fetch systems' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { systemName, systemOwner, ownerEmail, ownerPhone, classification, purpose, networkType } = req.body;
    if (!systemName || !systemOwner || !ownerEmail || !purpose) {
      return res.status(400).json({ error: 'systemName, systemOwner, ownerEmail, and purpose are required' });
    }

    const system = await db.lavaSystemRequest.create({
      data: {
        systemName,
        systemOwner,
        ownerEmail,
        ownerPhone:     ownerPhone     || null,
        classification: classification || 'UNCLASSIFIED',
        purpose,
        networkType:    networkType    || null,
        status:         'pending',
      },
    });

    await writeAudit(
      req,
      'submit',
      'system_request',
      system.id,
      `Submitted system request for ${system.systemName}`,
      system.siteId
    );

    res.status(201).json(system);
  } catch (err) {
    console.error('[LAVA/systems] create error', err);
    res.status(500).json({ error: 'Failed to create system integration request' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const system = await db.lavaSystemRequest.findUnique({
      where:   { id: req.params.id },
      include: { assets: true },
    });
    if (!system) return res.status(404).json({ error: 'System not found' });
    res.json(system);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch system' });
  }
});

router.patch('/:id/status', requireVulcan, async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['pending', 'active', 'rejected', 'decommissioned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const system = await db.lavaSystemRequest.update({
      where: { id: req.params.id },
      data:  {
        status,
        reviewNotes: reviewNotes ? reviewNotes.trim() : null,
        reviewedBy: actor(req),
      },
    });
    await writeAudit(
      req,
      'status_change',
      'system_request',
      system.id,
      `System ${system.systemName} moved to ${status}`,
      system.siteId
    );
    res.json(system);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update system status' });
  }
});

module.exports = router;
