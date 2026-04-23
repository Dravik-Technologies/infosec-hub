'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const router  = express.Router();

// GET /api/aggregate/metrics
// Corporate Admin cross-site program view. No tenant filter applied — returns all sites.
router.get('/metrics', async (req, res, next) => {
  if (req.user?.role !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const sites = await db.site.findMany({ orderBy: { label: 'asc' } });
    const now   = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const in90  = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const in90Str = in90.toISOString().split('T')[0];

    const siteRows = await Promise.all(sites.map(async site => {
      const [controls, poams, atos, events] = await Promise.all([
        db.control.findMany({ where: { siteId: site.id }, select: { status: true } }),
        db.poam.findMany({
          where: { siteId: site.id },
          select: { status: true, scheduledCompletion: true },
        }),
        db.atoPackage.findMany({
          where: { siteId: site.id },
          select: { status: true, expires: true },
        }),
        db.securityEvent.findMany({
          where: { siteId: site.id },
          select: { status: true, severity: true },
        }),
      ]);

      const implControls = controls.filter(c => c.status === 'Implemented').length;

      const openPoams    = poams.filter(p => p.status === 'Open' || p.status === 'In Progress');
      const overduePoams = openPoams.filter(p => p.scheduledCompletion && p.scheduledCompletion < todayStr);

      const activeAtos   = atos.filter(a => a.status === 'Authorized').length;
      const expiringAtos = atos.filter(a =>
        a.status === 'Authorized' && a.expires && a.expires >= todayStr && a.expires <= in90Str
      ).length;

      const newEvents      = events.filter(e => e.status === 'New').length;
      const criticalEvents = events.filter(e => e.severity === 'Critical' || e.severity === 'High').length;

      return {
        id:    site.id,
        label: site.label,
        controls: {
          total: controls.length,
          implemented: implControls,
          pct: controls.length ? Math.round((implControls / controls.length) * 100) : 0,
        },
        poams: {
          total: poams.length,
          open: openPoams.length,
          overdue: overduePoams.length,
        },
        atos: {
          total: atos.length,
          active: activeAtos,
          expiring: expiringAtos,
        },
        events: {
          total: events.length,
          new: newEvents,
          criticalHigh: criticalEvents,
        },
      };
    }));

    // Aggregate totals
    const sum = (arr, fn) => arr.reduce((s, r) => s + fn(r), 0);
    const totals = {
      controls: {
        total: sum(siteRows, r => r.controls.total),
        implemented: sum(siteRows, r => r.controls.implemented),
        pct: 0,
      },
      poams: {
        total: sum(siteRows, r => r.poams.total),
        open:  sum(siteRows, r => r.poams.open),
        overdue: sum(siteRows, r => r.poams.overdue),
      },
      atos: {
        total:    sum(siteRows, r => r.atos.total),
        active:   sum(siteRows, r => r.atos.active),
        expiring: sum(siteRows, r => r.atos.expiring),
      },
      events: {
        total:        sum(siteRows, r => r.events.total),
        new:          sum(siteRows, r => r.events.new),
        criticalHigh: sum(siteRows, r => r.events.criticalHigh),
      },
    };
    totals.controls.pct = totals.controls.total
      ? Math.round((totals.controls.implemented / totals.controls.total) * 100)
      : 0;

    res.json({ sites: siteRows, totals });
  } catch (err) { next(err); }
});

module.exports = router;
