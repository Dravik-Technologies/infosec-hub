'use strict';

const router = require('express').Router();
const { db } = require('../db');
const { actor, writeAudit } = require('../audit');
const { requireVulcan, isSiteAllowed } = require('../authz');

// Corporate Admin / canSeeAllSites → no restriction.
// site-scoped users → their sites + enterprise-wide (siteId IS NULL) records.
// no site context at all → enterprise-wide records only (siteId IS NULL, not all records).
function buildSiteFilter(viewer) {
  if (!viewer) return { siteId: null };
  if (viewer.role === 'Corporate Admin' || viewer.canSeeAllSites) return null;

  const siteIds = Array.isArray(viewer.siteIds) ? viewer.siteIds.filter(Boolean) : [];
  if (viewer.siteId && !siteIds.includes(viewer.siteId)) siteIds.push(viewer.siteId);

  if (siteIds.length === 0) return { siteId: null }; // no site context — enterprise-wide only
  return { OR: [{ siteId: { in: siteIds } }, { siteId: null }] };
}

router.get('/', async (req, res) => {
  try {
    const siteFilter = buildSiteFilter(req.session.user);
    const systems = await db.lavaSystemRequest.findMany({
      where:   siteFilter || {},
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
    const { systemName, systemOwner, ownerEmail, ownerPhone, classification, purpose, networkType, siteId: requestedSiteId } = req.body;
    if (!systemName || !systemOwner || !ownerEmail || !purpose) {
      return res.status(400).json({ error: 'systemName, systemOwner, ownerEmail, and purpose are required' });
    }

    // Accept an explicitly requested siteId for multi-site operators (e.g. the client passes the
    // currently selected site). Only honored if the caller is actually allowed for that site.
    // Intentional fallback: an out-of-scope or missing siteId silently uses the session primary
    // site rather than returning 403 — the write is still safe because it lands within the
    // caller's own authorized sites. A stricter 403 model is possible but would require the
    // client to always supply a valid siteId, which is not currently a client-side contract.
    let resolvedSiteId = req.session.user ? req.session.user.siteId : null;
    if (requestedSiteId && isSiteAllowed(req.session.user, requestedSiteId)) {
      resolvedSiteId = requestedSiteId;
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
        siteId:         resolvedSiteId,
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
    if (!isSiteAllowed(req.session.user, system.siteId)) {
      return res.status(403).json({ error: 'Access denied — system is outside your site scope' });
    }
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

    const existing = await db.lavaSystemRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'System not found' });
    if (!isSiteAllowed(req.session.user, existing.siteId)) {
      return res.status(403).json({ error: 'Access denied — system is outside your site scope' });
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
