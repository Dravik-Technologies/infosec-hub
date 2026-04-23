'use strict';

const express = require('express');
const { db }  = require('../../../packages/db/src/index');
const router  = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(value, now = new Date()) {
  const d = safeDate(value);
  if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / DAY_MS);
}

function bucketPoamAge(days) {
  if (days == null || days < 0) return null;
  if (days > 90) return 'over90';
  if (days > 60) return 'over60';
  if (days > 30) return 'over30';
  return 'under30';
}

function riskLevel(score) {
  if (score >= 75) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

function increment(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

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
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            scheduledCompletion: true,
            identifiedDate: true,
            riskDecision: true,
            riskWorkflowState: true,
          },
        }),
        db.atoPackage.findMany({
          where: { siteId: site.id },
          select: { id: true, system: true, status: true, expires: true },
        }),
        db.securityEvent.findMany({
          where: { siteId: site.id },
          select: { id: true, type: true, status: true, severity: true, source: true, createdAt: true },
        }),
      ]);

      const implControls = controls.filter(c => c.status === 'Implemented').length;
      const partialControls = controls.filter(c => c.status === 'Partially Implemented').length;
      const notImplementedControls = controls.filter(c => c.status === 'Not Implemented').length;

      const openPoams    = poams.filter(p => p.status === 'Open' || p.status === 'In Progress');
      const overduePoams = openPoams.filter(p => p.scheduledCompletion && p.scheduledCompletion < todayStr);
      const poamAging = { under30: 0, over30: 0, over60: 0, over90: 0 };
      const poamSeverity = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      const riskWorkflow = { Draft: 0, Submitted: 0, 'Under Review': 0, Approved: 0, Rejected: 0 };
      openPoams.forEach(p => {
        increment(poamSeverity, p.severity || 'Medium');
        increment(riskWorkflow, p.riskWorkflowState || 'Draft');
        const ageStart = p.identifiedDate || p.scheduledCompletion;
        const ageDate = safeDate(ageStart);
        const ageDays = ageDate ? Math.max(0, Math.floor((now.getTime() - ageDate.getTime()) / DAY_MS)) : null;
        const ageBucket = bucketPoamAge(ageDays);
        if (ageBucket) increment(poamAging, ageBucket);
      });

      const activeAtos   = atos.filter(a => a.status === 'Authorized').length;
      const expiringAtos = atos.filter(a =>
        a.status === 'Authorized' && a.expires && a.expires >= todayStr && a.expires <= in90Str
      ).length;
      const atoExpiration = { expired: 0, under30: 0, under60: 0, under90: 0, beyond90: 0, unknown: 0 };
      atos.forEach(a => {
        const remaining = daysUntil(a.expires, now);
        if (remaining == null) atoExpiration.unknown++;
        else if (remaining < 0) atoExpiration.expired++;
        else if (remaining <= 30) atoExpiration.under30++;
        else if (remaining <= 60) atoExpiration.under60++;
        else if (remaining <= 90) atoExpiration.under90++;
        else atoExpiration.beyond90++;
      });

      const newEvents      = events.filter(e => e.status === 'New').length;
      const criticalEvents = events.filter(e => e.severity === 'Critical' || e.severity === 'High').length;
      const eventSeverity = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      const eventStatus = {};
      const eventTypes = {};
      events.forEach(e => {
        increment(eventSeverity, e.severity || 'Medium');
        increment(eventStatus, e.status || 'New');
        increment(eventTypes, e.type || 'Other');
      });

      const controlPct = controls.length ? Math.round((implControls / controls.length) * 100) : 0;
      const criticalPoams = openPoams.filter(p => p.severity === 'Critical').length;
      const highPoams = openPoams.filter(p => p.severity === 'High').length;
      const riskScore = Math.min(100, Math.round(
        (100 - controlPct) * 0.35 +
        overduePoams.length * 8 +
        criticalPoams * 10 +
        highPoams * 6 +
        criticalEvents * 7 +
        atoExpiration.expired * 12 +
        expiringAtos * 5
      ));

      return {
        id:    site.id,
        label: site.label,
        controls: {
          total: controls.length,
          implemented: implControls,
          partial: partialControls,
          notImplemented: notImplementedControls,
          pct: controlPct,
        },
        poams: {
          total: poams.length,
          open: openPoams.length,
          overdue: overduePoams.length,
          critical: criticalPoams,
          high: highPoams,
          aging: poamAging,
          severity: poamSeverity,
          riskWorkflow,
        },
        atos: {
          total: atos.length,
          active: activeAtos,
          expiring: expiringAtos,
          expiration: atoExpiration,
        },
        events: {
          total: events.length,
          new: newEvents,
          criticalHigh: criticalEvents,
          severity: eventSeverity,
          status: eventStatus,
          types: eventTypes,
        },
        risk: {
          score: riskScore,
          level: riskLevel(riskScore),
          drivers: {
            controlGap: Math.max(0, 100 - controlPct),
            overduePoams: overduePoams.length,
            criticalHighPoams: criticalPoams + highPoams,
            criticalHighEvents: criticalEvents,
            expiringAtos,
            expiredAtos: atoExpiration.expired,
          },
        },
      };
    }));

    // Aggregate totals
    const sum = (arr, fn) => arr.reduce((s, r) => s + fn(r), 0);
    const totals = {
      controls: {
        total: sum(siteRows, r => r.controls.total),
        implemented: sum(siteRows, r => r.controls.implemented),
        partial: sum(siteRows, r => r.controls.partial),
        notImplemented: sum(siteRows, r => r.controls.notImplemented),
        pct: 0,
      },
      poams: {
        total: sum(siteRows, r => r.poams.total),
        open:  sum(siteRows, r => r.poams.open),
        overdue: sum(siteRows, r => r.poams.overdue),
        critical: sum(siteRows, r => r.poams.critical),
        high: sum(siteRows, r => r.poams.high),
        aging: {
          under30: sum(siteRows, r => r.poams.aging.under30),
          over30: sum(siteRows, r => r.poams.aging.over30),
          over60: sum(siteRows, r => r.poams.aging.over60),
          over90: sum(siteRows, r => r.poams.aging.over90),
        },
      },
      atos: {
        total:    sum(siteRows, r => r.atos.total),
        active:   sum(siteRows, r => r.atos.active),
        expiring: sum(siteRows, r => r.atos.expiring),
        expired:  sum(siteRows, r => r.atos.expiration.expired),
        expiration: {
          expired: sum(siteRows, r => r.atos.expiration.expired),
          under30: sum(siteRows, r => r.atos.expiration.under30),
          under60: sum(siteRows, r => r.atos.expiration.under60),
          under90: sum(siteRows, r => r.atos.expiration.under90),
          beyond90: sum(siteRows, r => r.atos.expiration.beyond90),
          unknown: sum(siteRows, r => r.atos.expiration.unknown),
        },
      },
      events: {
        total:        sum(siteRows, r => r.events.total),
        new:          sum(siteRows, r => r.events.new),
        criticalHigh: sum(siteRows, r => r.events.criticalHigh),
        severity: {
          Critical: sum(siteRows, r => r.events.severity.Critical),
          High: sum(siteRows, r => r.events.severity.High),
          Medium: sum(siteRows, r => r.events.severity.Medium),
          Low: sum(siteRows, r => r.events.severity.Low),
        },
      },
    };
    totals.controls.pct = totals.controls.total
      ? Math.round((totals.controls.implemented / totals.controls.total) * 100)
      : 0;

    const rankedSites = [...siteRows].sort((a, b) => b.risk.score - a.risk.score);
    const analytics = {
      generatedAt: now.toISOString(),
      riskPosture: {
        averageScore: siteRows.length ? Math.round(sum(siteRows, r => r.risk.score) / siteRows.length) : 0,
        highRiskSites: siteRows.filter(r => r.risk.level === 'High').length,
        moderateRiskSites: siteRows.filter(r => r.risk.level === 'Moderate').length,
        lowRiskSites: siteRows.filter(r => r.risk.level === 'Low').length,
      },
      topRiskSites: rankedSites.slice(0, 5).map(r => ({
        id: r.id,
        label: r.label,
        score: r.risk.score,
        level: r.risk.level,
        drivers: r.risk.drivers,
      })),
      heatmap: rankedSites.map(r => ({
        siteId: r.id,
        siteLabel: r.label,
        riskScore: r.risk.score,
        riskLevel: r.risk.level,
        controls: r.controls.pct,
        poams: r.poams.overdue + r.poams.critical + r.poams.high,
        atos: r.atos.expiring + r.atos.expiration.expired,
        events: r.events.criticalHigh,
      })),
      trendInputs: {
        poamAging: totals.poams.aging,
        atoExpiration: totals.atos.expiration,
        eventSeverity: totals.events.severity,
        controlStatus: {
          Implemented: totals.controls.implemented,
          'Partially Implemented': totals.controls.partial,
          'Not Implemented': totals.controls.notImplemented,
        },
      },
    };

    res.json({ sites: siteRows, totals, analytics });
  } catch (err) { next(err); }
});

module.exports = router;
