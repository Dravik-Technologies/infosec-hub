'use strict';

const cron = require('node-cron');
const { db } = require('../../../packages/db/src/index');
const { buildNotificationId } = require('../utils/notificationIds');

// Tracks cveId:siteId combos already notified this server session to avoid repeat alerts
const notifiedCves = new Set();

const OS_KEYWORDS = [
  'windows', 'ubuntu', 'debian', 'centos', 'red hat', 'rhel',
  'fedora', 'suse', 'android', 'ios', 'macos', 'mac os',
  'apache', 'nginx', 'chrome', 'firefox', 'edge', 'safari',
];

function osMatchesCve(os, description) {
  if (!os || !description) return false;
  const desc = description.toLowerCase();
  const osLower = os.toLowerCase();
  for (const kw of OS_KEYWORDS) {
    if (osLower.includes(kw) && desc.includes(kw)) return true;
  }
  // Also check significant tokens from the OS string (length >= 6)
  const tokens = osLower.split(/[\s/\-_]+/).filter(t => t.length >= 6);
  return tokens.some(t => desc.includes(t));
}

async function runCveAlertCheck() {
  try {
    const now = new Date();
    const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      resultsPerPage: '20',
      pubStartDate: start.toISOString(),
      pubEndDate: now.toISOString(),
    });

    const response = await fetch(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?${params.toString()}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) }
    );
    if (!response.ok) throw new Error(`NVD responded with ${response.status}`);

    const json = await response.json();

    // Only alert on High (7.0+) or Critical (9.0+) CVEs
    const cves = (json.vulnerabilities || [])
      .map(v => {
        const metrics = v.cve.metrics?.cvssMetricV31?.[0]?.cvssData ||
                        v.cve.metrics?.cvssMetricV30?.[0]?.cvssData || null;
        return {
          id: v.cve.id,
          description: (v.cve.descriptions || []).find(d => d.lang === 'en')?.value || '',
          severity: metrics?.baseSeverity || 'UNKNOWN',
          score: metrics?.baseScore || 0,
        };
      })
      .filter(c => c.score >= 7.0);

    if (!cves.length) return;

    // Group workstation OS values by siteId
    const workstations = await db.workstation.findMany({
      where: { os: { not: null } },
      select: { os: true, siteId: true },
    });
    const siteOsList = {};
    for (const ws of workstations) {
      if (!ws.siteId) continue;
      (siteOsList[ws.siteId] ??= []).push(ws.os);
    }

    for (const cve of cves) {
      for (const [siteId, osList] of Object.entries(siteOsList)) {
        const key = `${cve.id}:${siteId}`;
        if (notifiedCves.has(key)) continue;
        if (!osList.some(os => osMatchesCve(os, cve.description))) continue;

        const alreadySent = await db.notification.findFirst({
          where: {
            siteId,
            title: { startsWith: `${cve.id} (` },
            createdAt: { gte: start },
          },
          select: { id: true },
        });
        if (alreadySent) {
          notifiedCves.add(key);
          continue;
        }

        notifiedCves.add(key);

        const type = cve.score >= 9.0 ? 'error' : 'warning';
        await db.notification.create({
          data: {
            id: buildNotificationId(),
            type,
            title: `${cve.id} (${cve.severity} ${cve.score}) — asset OS match`,
            message: cve.description.slice(0, 300),
            siteId,
          },
        });
        console.log(`[SCORVA] CVE alert: ${cve.id} matched site ${siteId}`);
      }
    }
  } catch (err) {
    console.warn('[SCORVA] CVE alerting job failed:', err.message);
  }
}

function start() {
  // Runs every 6 hours; staggered from the hour to avoid NVD rate limit collisions
  cron.schedule('30 */6 * * *', runCveAlertCheck, { timezone: 'UTC' });
  console.log('[SCORVA] CVE alerting job scheduled (every 6 hours)');
}

module.exports = { start, runCveAlertCheck };
