'use strict';

const cron = require('node-cron');
const { db } = require('../../../packages/db/src/index');
const { buildNotificationId } = require('../utils/notificationIds');

async function runPoamAgingCheck() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const poams = await db.poam.findMany({
      where: { status: { in: ['Open', 'In Progress'] }, scheduledCompletion: { not: null } },
      select: { id: true, title: true, siteId: true, scheduledCompletion: true },
    });

    for (const poam of poams) {
      const due = new Date(poam.scheduledCompletion);
      if (isNaN(due.getTime())) continue;

      const daysLeft = Math.ceil((due - now) / 86_400_000);
      if (daysLeft > 30) continue;

      // Only alert at 30d, 14d, 7d, 0d thresholds to avoid daily noise
      const isThreshold = daysLeft <= 0 || daysLeft === 7 || daysLeft === 14 || daysLeft === 30;
      if (!isThreshold) continue;

      // Skip if we already sent this POA&M an alert today
      const alreadySent = await db.notification.findFirst({
        where: { siteId: poam.siteId, title: { contains: poam.id }, createdAt: { gte: todayStart } },
        select: { id: true },
      });
      if (alreadySent) continue;

      const type = daysLeft <= 0 ? 'error' : daysLeft <= 7 ? 'warning' : 'info';
      const label = daysLeft <= 0
        ? `${Math.abs(daysLeft)} day(s) overdue`
        : `due in ${daysLeft} day(s)`;

      await db.notification.create({
        data: {
          id: buildNotificationId(),
          type,
          title: `POA&M ${poam.id} — ${label}`,
          message: poam.title,
          siteId: poam.siteId,
        },
      });
      console.log(`[SCORVA] POA&M aging: ${poam.id} (${label})`);
    }
  } catch (err) {
    console.error('[SCORVA] POA&M aging job failed:', err.message);
  }
}

function start() {
  cron.schedule('0 8 * * *', runPoamAgingCheck, { timezone: 'UTC' });
  console.log('[SCORVA] POA&M aging job scheduled (daily 08:00 UTC)');
}

module.exports = { start, runPoamAgingCheck };
