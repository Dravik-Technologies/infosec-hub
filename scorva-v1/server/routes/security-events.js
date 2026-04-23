'use strict';

const crypto  = require('crypto');
const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const audit   = require('../middleware/audit');
const { buildNotificationId } = require('../utils/notificationIds');
const router  = express.Router();

function buildEventId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SE-${ts}-${rand}`;
}

// GET /api/security-events
router.get('/', async (req, res, next) => {
  try {
    res.json(await db.securityEvent.findMany({
      where: req.applyTenantFilter({}),
      orderBy: { createdAt: 'desc' },
    }));
  } catch (err) { next(err); }
});

// POST /api/security-events
router.post('/', async (req, res, next) => {
  const { type, severity, source, assetId, description, status } = req.body;
  const siteId = req.resolveTenantSiteId(req.body);
  if (!siteId) return res.status(400).json({ error: 'siteId is required' });

  try {
    const doc = await db.securityEvent.create({
      data: {
        id:          buildEventId(),
        type:        type        || 'Other',
        severity:    severity    || 'Medium',
        source:      source      || null,
        assetId:     assetId     || null,
        description: description || null,
        status:      status      || 'New',
        siteId,
      },
    });

    // ── Correlation: 3+ events from same source in last 24h → notify ────────
    if (source) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const count = await db.securityEvent.count({
        where: { siteId, source, createdAt: { gte: since } },
      });

      if (count >= 3) {
        const alertTitle = `Repeated events: ${source} (${count} in 24h)`;
        const dedupSince = new Date(Date.now() - 60 * 60 * 1000);
        const alreadySent = await db.notification.findFirst({
          where: { siteId, title: alertTitle, createdAt: { gte: dedupSince } },
          select: { id: true },
        });
        if (!alreadySent) {
          await db.notification.create({
            data: {
              id:      buildNotificationId(),
              type:    count >= 5 ? 'error' : 'warning',
              title:   alertTitle,
              message: `${count} security events from "${source}" detected in the last 24 hours. Review for potential threat pattern.`,
              siteId,
            },
          });
          console.log(`[SCORVA] Security event correlation alert: ${alertTitle}`);
        }
      }
    }

    await audit(req.session.user.username, 'SECURITY_EVENT_ADD', doc.id,
      `Added: ${doc.type} — ${source || 'unknown source'}`, siteId);
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

// PATCH /api/security-events/:id
router.patch('/:id', async (req, res, next) => {
  const FIELD_MAP = {
    type: 'type', severity: 'severity', source: 'source',
    asset_id: 'assetId', assetId: 'assetId', description: 'description', status: 'status',
  };
  const data = {};
  for (const [k, pk] of Object.entries(FIELD_MAP)) {
    if (k in req.body) data[pk] = req.body[k];
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const doc = await db.securityEvent.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });

    const updated = await db.securityEvent.update({ where: { id: req.params.id }, data });
    await audit(req.session.user.username, 'SECURITY_EVENT_UPDATE', req.params.id,
      `Updated: ${Object.keys(data).join(', ')}`, doc.siteId);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/security-events/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await db.securityEvent.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
    await db.securityEvent.delete({ where: { id: req.params.id } });
    await audit(req.session.user.username, 'SECURITY_EVENT_DELETE', req.params.id, 'Deleted', doc.siteId);
    res.json({ deleted: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
