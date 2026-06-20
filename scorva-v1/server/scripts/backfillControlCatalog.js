'use strict';

/**
 * Phase 1 additive backfill for SCORVA control catalog migration.
 *
 * Reads legacy `controls` rows and creates:
 *   - ControlCatalog definitions
 *   - SiteControlImplementation records
 *
 * Modes:
 *   --owner-scope=enterprise   One shared catalog definition per control ID
 *   --owner-scope=site         One site-owned catalog definition per site+control ID
 *
 * Usage:
 *   node backfillControlCatalog.js [--dry-run] [--owner-scope=enterprise|site] [--verbose]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });

const { db } = require('../../../packages/db/src');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const ownerScopeArg = args.find(a => a.startsWith('--owner-scope='));
const OWNER_SCOPE = ownerScopeArg ? ownerScopeArg.replace('--owner-scope=', '').trim() : 'enterprise';

if (!['enterprise', 'site'].includes(OWNER_SCOPE)) {
  console.error('[control-backfill] Invalid --owner-scope. Use enterprise or site.');
  process.exit(1);
}

function log(...msg) { console.log('[control-backfill]', ...msg); }
function verbose(...msg) { if (VERBOSE) console.log('[control-backfill:verbose]', ...msg); }

function buildCatalogUniqueKey(row) {
  return OWNER_SCOPE === 'site'
    ? `site:${row.siteId}:${row.id}`
    : `enterprise:${row.id}`;
}

function catalogPayloadFromControl(row) {
  const ownerType = OWNER_SCOPE === 'site' ? 'site' : 'enterprise';
  return {
    controlKey: row.id,
    title: row.title,
    family: row.family || null,
    baseline: row.baseline || null,
    description: row.description || null,
    source: 'Legacy SCORVA Control',
    implementationDefault: row.implementationGuidance || null,
    ownerType,
    ownerSiteId: ownerType === 'site' ? row.siteId : null,
    isTemplate: true,
    isActive: true,
    version: null,
    tenantId: null,
  };
}

async function ensureCatalogRow(row, cache) {
  const cacheKey = buildCatalogUniqueKey(row);
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const payload = catalogPayloadFromControl(row);
  const existing = await db.controlCatalog.findFirst({
    where: {
      tenantId: null,
      ownerType: payload.ownerType,
      ownerSiteId: payload.ownerSiteId,
      controlKey: payload.controlKey,
    },
    select: { id: true },
  });

  if (existing) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  if (DRY_RUN) {
    const fakeId = `dryrun:${cacheKey}`;
    cache.set(cacheKey, fakeId);
    verbose('would create catalog', cacheKey, payload.title);
    return fakeId;
  }

  const created = await db.controlCatalog.create({ data: payload, select: { id: true } });
  cache.set(cacheKey, created.id);
  verbose('created catalog', cacheKey, created.id);
  return created.id;
}

async function main() {
  log(`Starting control catalog backfill${DRY_RUN ? ' (DRY RUN)' : ''} with owner scope = ${OWNER_SCOPE}`);
  const controls = await db.control.findMany({ orderBy: [{ siteId: 'asc' }, { family: 'asc' }, { id: 'asc' }] });

  if (!controls.length) {
    log('No legacy controls found. Nothing to backfill.');
    return;
  }

  const catalogCache = new Map();
  let catalogsCreatedEstimate = 0;
  let implementationsCreated = 0;
  let implementationsUpdated = 0;

  for (const row of controls) {
    const catalogId = await ensureCatalogRow(row, catalogCache);
    catalogsCreatedEstimate = catalogCache.size;

    const implementationData = {
      siteId: row.siteId,
      controlCatalogId: catalogId,
      status: row.status || 'Not Implemented',
      lastReview: row.lastReview || null,
      findings: row.findings || 0,
      notes: row.notes || null,
      implementationGuidance: row.implementationGuidance || null,
      conmonStatus: row.conmonStatus || null,
      conmonGroup: row.conmonGroup || null,
      conmonFrequency: row.conmonFrequency || null,
      evidenceSummary: null,
      assignedTo: null,
      tenantId: null,
    };

    const existing = await db.siteControlImplementation.findFirst({
      where: {
        siteId: row.siteId,
        controlCatalogId: catalogId,
      },
      select: { id: true },
    });

    if (existing) {
      verbose('existing implementation', row.siteId, row.id, existing.id);
      if (!DRY_RUN) {
        await db.siteControlImplementation.update({
          where: { id: existing.id },
          data: implementationData,
        });
      }
      implementationsUpdated += 1;
      continue;
    }

    verbose('create implementation', row.siteId, row.id, catalogId);
    if (!DRY_RUN) {
      await db.siteControlImplementation.create({ data: implementationData });
    }
    implementationsCreated += 1;
  }

  log('---');
  log(`Catalog definitions ${DRY_RUN ? 'would cover' : 'covered'}: ${catalogsCreatedEstimate}`);
  log(`Site implementations ${DRY_RUN ? 'would create' : 'created'}: ${implementationsCreated}`);
  log(`Site implementations ${DRY_RUN ? 'would update' : 'updated'}: ${implementationsUpdated}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[control-backfill] Fatal error:', err);
    process.exit(1);
  });
