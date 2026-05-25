'use strict';

/**
 * Phase B backfill: assign siteId to records that currently have siteId = NULL.
 *
 * Strategy per model:
 *   Workstation  — match by username → User.siteId (single-site users only)
 *   YubiKey      — match by username → User.siteId (single-site users only)
 *   License      — no user FK; logged as ambiguous, requires manual admin assignment
 *   Tracker      — match by createdBy username → User.siteId
 *   EvidenceArtifact — match by uploadedBy username → User.siteId
 *
 * Usage:
 *   node backfillSiteId.js [--dry-run] [--model=Workstation,YubiKey,...] [--verbose]
 *
 * Flags:
 *   --dry-run   Log what would be updated without writing anything to the database.
 *   --model=X   Comma-separated list of models to process. Defaults to all.
 *   --verbose   Print each record being processed.
 *
 * Exit codes:
 *   0  Completed (including partial where some records are ambiguous)
 *   1  Fatal error (DB connection failure, etc.)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });

const { db } = require('../../../packages/db/src/index');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const modelArg = args.find(a => a.startsWith('--model='));
const MODELS_FILTER = modelArg
  ? new Set(modelArg.replace('--model=', '').split(',').map(m => m.trim()))
  : null;

function shouldRun(name) {
  return !MODELS_FILTER || MODELS_FILTER.has(name);
}

function log(...msg) { console.log('[backfill]', ...msg); }
function verbose(...msg) { if (VERBOSE) console.log('[backfill:verbose]', ...msg); }

/** Build a username → siteId map from the users table (single-site users only). */
async function buildUserSiteMap() {
  const users = await db.user.findMany({
    where: { siteId: { not: null } },
    select: { username: true, siteId: true },
  });
  const map = new Map();
  for (const u of users) {
    if (u.username && u.siteId) {
      // If a username appears more than once (shouldn't happen — username is unique)
      // keep the first occurrence.
      if (!map.has(u.username)) map.set(u.username, u.siteId);
    }
  }
  return map;
}

async function backfillByUsername(modelName, prismaModel, usernameField, userSiteMap) {
  const nullRecords = await prismaModel.findMany({
    where: { siteId: null },
  });

  if (!nullRecords.length) {
    log(`${modelName}: no records with null siteId — nothing to do`);
    return { updated: 0, ambiguous: 0 };
  }

  log(`${modelName}: ${nullRecords.length} records with null siteId`);
  let updated = 0;
  let ambiguous = 0;

  for (const rec of nullRecords) {
    const username = rec[usernameField];
    const siteId   = username ? userSiteMap.get(username) : null;

    if (!siteId) {
      log(`${modelName} ${rec.id}: AMBIGUOUS — username="${username ?? '(none)'}", no matching user siteId`);
      ambiguous++;
      continue;
    }

    verbose(`${modelName} ${rec.id}: username="${username}" → siteId="${siteId}"`);
    if (!DRY_RUN) {
      await prismaModel.update({ where: { id: rec.id }, data: { siteId } });
    }
    updated++;
  }

  log(`${modelName}: ${DRY_RUN ? '[DRY RUN] would update' : 'updated'} ${updated}, ambiguous ${ambiguous}`);
  return { updated, ambiguous };
}

async function backfillLicenses() {
  const nullRecords = await db.license.findMany({ where: { siteId: null } });
  if (!nullRecords.length) {
    log('License: no records with null siteId — nothing to do');
    return { updated: 0, ambiguous: 0 };
  }

  log(`License: ${nullRecords.length} records with null siteId`);
  log('License: no user FK available — all records marked ambiguous. Admin must assign siteId manually.');
  for (const rec of nullRecords) {
    log(`  License ${rec.id} (${rec.product}): AMBIGUOUS — manual assignment required`);
  }
  return { updated: 0, ambiguous: nullRecords.length };
}

async function main() {
  log(`Starting Phase B siteId backfill${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);

  const userSiteMap = await buildUserSiteMap();
  log(`User site map: ${userSiteMap.size} username→siteId entries loaded`);

  const totals = { updated: 0, ambiguous: 0 };

  function accum(result) {
    totals.updated    += result.updated;
    totals.ambiguous  += result.ambiguous;
  }

  if (shouldRun('Workstation')) {
    accum(await backfillByUsername('Workstation', db.workstation, 'username', userSiteMap));
  }

  if (shouldRun('YubiKey')) {
    accum(await backfillByUsername('YubiKey', db.yubiKey, 'username', userSiteMap));
  }

  if (shouldRun('License')) {
    accum(await backfillLicenses());
  }

  if (shouldRun('Tracker')) {
    accum(await backfillByUsername('Tracker', db.tracker, 'createdBy', userSiteMap));
  }

  if (shouldRun('EvidenceArtifact')) {
    accum(await backfillByUsername('EvidenceArtifact', db.evidenceArtifact, 'uploadedBy', userSiteMap));
  }

  log('---');
  log(`Total: ${DRY_RUN ? 'would update' : 'updated'} ${totals.updated}, ambiguous ${totals.ambiguous}`);
  if (totals.ambiguous > 0) {
    log('Ambiguous records must be resolved before making siteId NOT NULL (Phase B step 4).');
    log('Options: (a) assign via admin UI, (b) run SQL UPDATE directly, (c) delete if stale.');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  });
