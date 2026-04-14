'use strict';

/**
 * GET /api/threats/latest
 *
 * Proxies the NIST NVD CVE 2.0 API and returns the 8 most recently published
 * CVEs as simplified objects. Caches the response for 5 minutes to stay well
 * under the NVD rate limit (5 req / 30 s without an API key).
 */

const express = require('express');
const router  = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cache = { data: null, fetchedAt: 0 };

function buildNvdUrl() {
  // Rolling 30-day window so we always get recent CVEs
  const now   = new Date();
  const start = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const fmt   = d => d.toISOString().replace(/\.\d{3}Z$/, '.000');
  return `https://services.nvd.nist.gov/rest/json/cves/2.0` +
    `?resultsPerPage=12` +
    `&pubStartDate=${fmt(start)}` +
    `&pubEndDate=${fmt(now)}`;
}

function parseCve(vuln) {
  const cve  = vuln.cve;
  const desc = (cve.descriptions || []).find(d => d.lang === 'en')?.value || '';

  // Try CVSS v3.1, fall back to v3.0, then v2
  const metricsV31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
  const metricsV30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
  const metricsV2  = cve.metrics?.cvssMetricV2?.[0]?.cvssData;
  const metrics    = metricsV31 || metricsV30 || metricsV2 || null;

  return {
    id:          cve.id,
    description: desc,
    score:       metrics?.baseScore    ?? 0,
    severity:    metrics?.baseSeverity ?? '',
    vector:      metrics?.vectorString ?? '',
    published:   cve.published,
    status:      cve.vulnStatus || '',
  };
}

router.get('/latest', async (_req, res) => {
  try {
    const now = Date.now();

    // Serve cache if fresh
    if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json(cache.data);
    }

    const response = await fetch(buildNvdUrl(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`NVD API responded with ${response.status}`);
    }

    const json = await response.json();
    const data = (json.vulnerabilities || []).map(parseCve);

    cache = { data, fetchedAt: now };
    res.json(data);
  } catch (err) {
    console.warn('[SCORVA] Threats fetch failed:', err.message);
    // Return stale cache rather than an error, if we have any
    if (cache.data) return res.json(cache.data);
    res.status(503).json({ error: 'Threat feed temporarily unavailable' });
  }
});

module.exports = router;
