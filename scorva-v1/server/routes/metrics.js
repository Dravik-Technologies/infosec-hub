'use strict';

const express = require('express');
const { db } = require('../../../packages/db/src/index');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const filter = req.applyTenantFilter({});
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // ── POA&M aging ───────────────────────────────────────────────────────────
    const allPoams = await db.poam.findMany({
      where: filter,
      select: { status: true, scheduledCompletion: true, completedDate: true, closedDate: true, createdAt: true },
    });

    const openPoams    = allPoams.filter(p => p.status === 'Open' || p.status === 'In Progress');
    const overduePoams = openPoams.filter(p => p.scheduledCompletion && p.scheduledCompletion < todayStr);
    const avgDaysOpen  = openPoams.length
      ? Math.round(openPoams.reduce((s, p) => s + (now - new Date(p.createdAt)) / 86_400_000, 0) / openPoams.length)
      : 0;

    // ── Remediation SLA ───────────────────────────────────────────────────────
    const closedPoams    = allPoams.filter(p => p.status === 'Completed' || p.status === 'Closed');
    const closedWithDue  = closedPoams.filter(p => p.scheduledCompletion);
    const closedOnTime   = closedWithDue.filter(p => {
      const done = p.completedDate || p.closedDate;
      return done && done <= p.scheduledCompletion;
    });

    // ── Control coverage ──────────────────────────────────────────────────────
    const controls = await db.control.findMany({
      where: filter,
      select: { status: true, lastReview: true },
    });
    const implemented   = controls.filter(c => c.status === 'Implemented').length;
    const oneYearAgo    = new Date(now - 365 * 86_400_000).toISOString().split('T')[0];
    const reviewedRecently = controls.filter(c => c.lastReview && c.lastReview >= oneYearAgo).length;

    // ── Finding trends (new POAMs per week, last 4 weeks) ────────────────────
    const fourWeeksAgo = new Date(now - 28 * 86_400_000);
    const recentPoams  = await db.poam.findMany({
      where: { ...filter, createdAt: { gte: fourWeeksAgo } },
      select: { createdAt: true },
    });

    const findingTrends = [3, 2, 1, 0].map(i => {
      const weekStart = new Date(now - (i + 1) * 7 * 86_400_000);
      const weekEnd   = new Date(now - i * 7 * 86_400_000);
      return {
        week: weekStart.toISOString().split('T')[0],
        newFindings: recentPoams.filter(p => p.createdAt >= weekStart && p.createdAt < weekEnd).length,
      };
    });

    res.json({
      poamAging: {
        total: allPoams.length,
        open: openPoams.length,
        overdueCount: overduePoams.length,
        pctOverdue: openPoams.length ? Math.round((overduePoams.length / openPoams.length) * 100) : 0,
        avgDaysOpen,
      },
      remediationSla: {
        closedTotal: closedPoams.length,
        closedWithDue: closedWithDue.length,
        closedOnTime: closedOnTime.length,
        pctOnTime: closedWithDue.length ? Math.round((closedOnTime.length / closedWithDue.length) * 100) : null,
      },
      controlCoverage: {
        total: controls.length,
        implemented,
        pctImplemented: controls.length ? Math.round((implemented / controls.length) * 100) : 0,
        reviewedRecently,
        pctReviewed: controls.length ? Math.round((reviewedRecently / controls.length) * 100) : 0,
      },
      findingTrends,
    });
  } catch (err) { next(err); }
});

module.exports = router;
