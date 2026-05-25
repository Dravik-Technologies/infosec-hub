'use strict';

/**
 * Phase C backfill: migrate MASH JSON blob records (MashCollection) into the
 * 7 new relational tables.
 *
 * For each domain the script:
 *   1. Reads the JSON blob from mash_collections (via pg-store readCollection)
 *   2. Maps each record's fields to the relational schema
 *   3. Upserts by record.id so the script is idempotent
 *   4. Logs any records that are missing required fields (name/title) or siteId
 *
 * Usage:
 *   node backfillMashRelational.js [--dry-run] [--domain=facility_security,...] [--verbose] [--site-map=<path>]
 *
 * Flags:
 *   --dry-run         Log what would be inserted/upserted without writing anything.
 *   --domain=X        Comma-separated list of domains to process. Defaults to all 7.
 *   --verbose         Print each record being processed.
 *   --site-map=<path> Path to a JSON file mapping legacy siteId values to real sites.id
 *                     values. Example file content:
 *                       { "site-001": "cuid_of_real_site_1",
 *                         "site-002": "cuid_of_real_site_2",
 *                         "lincolnia-hq": "cuid_lincolnia",
 *                         "maryland-warehouse": "cuid_maryland" }
 *                     Records whose siteId is not found in the map (and is not already
 *                     a known real ID) are logged as ambiguous and skipped.
 *
 * Exit codes:
 *   0  Completed (including partial — some records ambiguous)
 *   1  Fatal error (DB connection failure, schema error, etc.)
 *
 * Prerequisites:
 *   - Migration 20260523200000_phase_c_mash_relational must be applied first.
 *   - Run from repo root or set DATABASE_URL in .env.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });

const { db } = require('../../packages/db/src');
const { readCollection } = require('../pg-store');

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const domainArg  = args.find(a => a.startsWith('--domain='));
const siteMapArg = args.find(a => a.startsWith('--site-map='));

const DOMAINS_FILTER = domainArg
  ? new Set(domainArg.replace('--domain=', '').split(',').map(d => d.trim()))
  : null;

// Legacy siteId → real sites.id translation map.
// Loaded from --site-map=<path> if provided; otherwise empty (pass-through).
let SITE_ID_MAP = {};
if (siteMapArg) {
  const mapPath = siteMapArg.replace('--site-map=', '');
  try {
    SITE_ID_MAP = JSON.parse(fs.readFileSync(path.resolve(mapPath), 'utf8'));
    console.log(`[backfill-mash] Loaded site map: ${Object.keys(SITE_ID_MAP).length} entries from ${mapPath}`);
  } catch (err) {
    console.error(`[backfill-mash] Fatal: could not load --site-map file: ${err.message}`);
    process.exit(1);
  }
}

/** Translate a raw siteId from the JSON blob to a real sites.id value. */
function resolveSiteId(raw) {
  if (!raw) return null;
  return SITE_ID_MAP[raw] ?? raw;
}

function shouldRun(name) {
  return !DOMAINS_FILTER || DOMAINS_FILTER.has(name);
}

function log(...msg)     { console.log('[backfill-mash]', ...msg); }
function verbose(...msg) { if (VERBOSE) console.log('[backfill-mash:verbose]', ...msg); }

const uid = () => 'bf-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

// ── Field mappers ─────────────────────────────────────────────────────────────
// Each mapper extracts the relational fields from a raw JSON blob record.
// Scalar fields are promoted to top-level columns; complex objects stay as JSONB.
// "required" is the NOT NULL field (name or title) used to detect empty stubs.

function mapFacility(r) {
  return {
    id:                 r.id || uid(),
    siteId:             resolveSiteId(r.siteId || r.siteID),
    name:               r.name || null,
    location:           r.location || null,
    facilityType:       r.facilityType || r.facility_type || null,
    fclLevel:           r.fclLevel || r.fcl_level || null,
    fclStatus:          r.fclStatus || r.fcl_status || null,
    fclExpires:         r.fclExpires || r.fcl_expires || null,
    fclPackage:         r.fclPackage || r.fcl_package || null,
    complianceScore:    r.complianceScore ?? r.compliance_score ?? null,
    status:             r.status || 'Active',
    notes:              r.notes || null,
    kmp:                r.kmp ?? [],
    accreditation:      r.accreditation ?? {},
    openStorage:        r.openStorage ?? r.open_storage ?? {},
    alarmIDS:           r.alarmIDS ?? r.alarm_ids ?? {},
    accessControl:      r.accessControl ?? r.access_control ?? {},
    dcsaInspection:     r.dcsaInspection ?? r.dcsa_inspection ?? {},
    internalInspection: r.internalInspection ?? r.internal_inspection ?? {},
    construction:       r.construction ?? {},
    waivers:            r.waivers ?? [],
    vulnerabilities:    r.vulnerabilities ?? [],
    openIssues:         r.openIssues ?? r.open_issues ?? [],
    createdBy:          r.createdBy || null,
    updatedBy:          r.updatedBy || null,
  };
}

function mapPersonnel(r) {
  return {
    id:                  r.id || uid(),
    siteId:              resolveSiteId(r.siteId || r.siteID),
    username:            r.username || null,
    name:                r.name || r.person || null,
    position:            r.position || null,
    org:                 r.org || null,
    clearanceLevel:      r.clearanceLevel || r.clearance_level || null,
    clearanceStatus:     r.clearanceStatus || r.clearance_status || null,
    clearanceGrantDate:  r.clearanceGrantDate || r.clearance_grant_date || null,
    clearancePRD:        r.clearancePRD || r.clearancePrd || r.clearance_prd || null,
    indocDate:           r.indocDate || r.indoc_date || null,
    debriefDate:         r.debriefDate || r.debrief_date || null,
    cvStatus:            r.cvStatus || r.cv_status || null,
    nbisEappStatus:      r.nbisEappStatus || r.nbis_eapp_status || null,
    notes:               r.notes || null,
    caveatAccess:        r.caveatAccess ?? r.caveat_access ?? [],
    formalAccess:        r.formalAccess ?? r.formal_access ?? [],
    training:            r.training ?? {},
    visitAccessRequests: r.visitAccessRequests ?? r.visit_access_requests ?? [],
    adverseInfo:         r.adverseInfo ?? r.adverse_info ?? [],
    foreignContacts:     r.foreignContacts ?? r.foreign_contacts ?? [],
    foreignTravel:       r.foreignTravel ?? r.foreign_travel ?? [],
    createdBy:           r.createdBy || null,
    updatedBy:           r.updatedBy || null,
  };
}

function mapActivity(r) {
  return {
    id:               r.id || uid(),
    siteId:           resolveSiteId(r.siteId || r.siteID),
    category:         r.category || null,
    title:            r.title || null,
    date:             r.date || null,
    time:             r.time || null,
    location:         r.location || null,
    classification:   r.classification || null,
    status:           r.status || 'Planned',
    owner:            r.owner || null,
    visitorCount:     r.visitorCount ?? r.visitor_count ?? null,
    clearanceVerified: r.clearanceVerified ?? r.clearance_verified ?? null,
    briefingRequired: r.briefingRequired ?? r.briefing_required ?? null,
    notes:            r.notes || null,
    participants:     r.participants ?? [],
    evidenceLinks:    r.evidenceLinks ?? r.evidence_links ?? [],
    createdBy:        r.createdBy || null,
    updatedBy:        r.updatedBy || null,
  };
}

function mapDocument(r) {
  return {
    id:                  r.id || uid(),
    siteId:              resolveSiteId(r.siteId || r.siteID),
    docNumber:           r.docNumber || r.doc_number || null,
    title:               r.title || null,
    classification:      r.classification || null,
    program:             r.program || null,
    category:            r.category || null,
    copyCount:           r.copyCount ?? r.copy_count ?? null,
    accountable:         r.accountable ?? false,
    custodian:           r.custodian || null,
    currentLocation:     r.currentLocation || r.current_location || null,
    version:             r.version || null,
    date:                r.date || null,
    lastInventory:       r.lastInventory || r.last_inventory || null,
    nextInventory:       r.nextInventory || r.next_inventory || null,
    reproductionControls: r.reproductionControls || r.reproduction_controls || null,
    status:              r.status || 'Active',
    notes:               r.notes || null,
    receipts:            r.receipts ?? [],
    dispatches:          r.dispatches ?? [],
    destructions:        r.destructions ?? [],
    createdBy:           r.createdBy || null,
    updatedBy:           r.updatedBy || null,
  };
}

function mapMedia(r) {
  return {
    id:            r.id || uid(),
    siteId:        resolveSiteId(r.siteId || r.siteID),
    mediaId:       r.mediaId || r.media_id || null,
    type:          r.type || null,
    label:         r.label || null,
    classification: r.classification || null,
    program:       r.program || null,
    capacityGB:    r.capacityGB ?? r.capacityGb ?? r.capacity_gb ?? null,
    make:          r.make || null,
    model:         r.model || null,
    serialNumber:  r.serialNumber || r.serial_number || null,
    status:        r.status || 'Unassigned',
    assignedTo:    r.assignedTo || r.assigned_to || null,
    assignedDate:  r.assignedDate || r.assigned_date || null,
    returnDue:     r.returnDue || r.return_due || null,
    system:        r.system || null,
    lastScan:      r.lastScan || r.last_scan || null,
    lastApproval:  r.lastApproval || r.last_approval || null,
    approvedBy:    r.approvedBy || r.approved_by || null,
    notes:         r.notes || null,
    flags:         r.flags ?? [],
    history:       r.history ?? [],
    createdBy:     r.createdBy || null,
    updatedBy:     r.updatedBy || null,
  };
}

function mapInspection(r) {
  return {
    id:            r.id || uid(),
    siteId:        resolveSiteId(r.siteId || r.siteID),
    title:         r.title || null,
    year:          r.year ?? null,
    status:        r.status || 'Planned',
    startDate:     r.startDate || r.start_date || null,
    dueDate:       r.dueDate || r.due_date || null,
    completedDate: r.completedDate || r.completed_date || null,
    inspector:     r.inspector || null,
    standard:      r.standard || null,
    progress:      r.progress ?? 0,
    kmaBriefed:    r.kmaBriefed ?? r.kma_briefed ?? false,
    reportPackage: r.reportPackage || r.report_package || null,
    notes:         r.notes || null,
    scope:         r.scope ?? [],
    findings:      r.findings ?? [],
    evidence:      r.evidence ?? [],
    createdBy:     r.createdBy || null,
    updatedBy:     r.updatedBy || null,
  };
}

function mapFinding(r) {
  return {
    id:            r.id || uid(),
    siteId:        resolveSiteId(r.siteId || r.siteID),
    findingNumber: r.findingNumber || r.finding_number || null,
    area:          r.area || null,
    requirement:   r.requirement || null,
    finding:       r.finding || null,
    severity:      r.severity || 'Medium',
    status:        r.status || 'Open',
    owner:         r.owner || null,
    openDate:      r.openDate || r.open_date || null,
    dueDate:       r.dueDate || r.due_date || null,
    closedDate:    r.closedDate || r.closed_date || null,
    corrective:    r.corrective || null,
    notes:         r.notes || null,
    inspectionId:  r.inspectionId || r.inspection_id || null,
    evidence:      r.evidence ?? [],
    createdBy:     r.createdBy || null,
    updatedBy:     r.updatedBy || null,
  };
}

// ── Domain config ─────────────────────────────────────────────────────────────
const DOMAINS = [
  {
    name:       'facility_security',
    model:      () => db.mashFacilitySecurity,
    mapper:     mapFacility,
    required:   'name',
  },
  {
    name:       'personnel_security',
    model:      () => db.mashPersonnelSecurity,
    mapper:     mapPersonnel,
    required:   'name',
  },
  {
    name:       'activities_security',
    model:      () => db.mashActivitiesSecurity,
    mapper:     mapActivity,
    required:   'title',
  },
  {
    name:       'document_control',
    model:      () => db.mashDocumentControl,
    mapper:     mapDocument,
    required:   'title',
  },
  {
    name:       'media_control',
    model:      () => db.mashMediaControl,
    mapper:     mapMedia,
    required:   'mediaId',
  },
  {
    name:       'self_inspection_ops',
    model:      () => db.mashSelfInspectionOp,
    mapper:     mapInspection,
    required:   'title',
  },
  {
    name:       'security_findings',
    model:      () => db.mashSecurityFinding,
    mapper:     mapFinding,
    required:   'finding',
  },
];

// ── Valid site preflight ──────────────────────────────────────────────────────
async function loadValidSiteIds() {
  const sites = await db.site.findMany({ select: { id: true } });
  const ids = new Set(sites.map(s => s.id));
  log(`Preflight: ${ids.size} valid site IDs loaded from DB`);
  if (ids.size === 0) {
    console.error('[backfill-mash] Fatal: sites table is empty — run site seed before backfill');
    process.exit(1);
  }
  return ids;
}

// ── Core backfill logic ───────────────────────────────────────────────────────
async function backfillDomain({ name, model, mapper, required }, validSiteIds) {
  log(`${name}: reading JSON blob...`);
  let blob;
  try {
    blob = await readCollection(name);
  } catch (err) {
    log(`${name}: SKIP — could not read collection: ${err.message}`);
    return { inserted: 0, skipped: 0, ambiguous: 0 };
  }

  if (!Array.isArray(blob) || blob.length === 0) {
    log(`${name}: no JSON records found — nothing to migrate`);
    return { inserted: 0, skipped: 0, ambiguous: 0 };
  }

  log(`${name}: ${blob.length} JSON records to process`);
  let inserted = 0, skipped = 0, ambiguous = 0;

  const now = new Date();

  for (const raw of blob) {
    const mapped = mapper(raw);

    if (!mapped.siteId) {
      log(`${name} ${mapped.id}: AMBIGUOUS — no siteId, skipping`);
      ambiguous++;
      continue;
    }

    if (!validSiteIds.has(mapped.siteId)) {
      log(`${name} ${mapped.id}: AMBIGUOUS — unresolved siteId "${mapped.siteId}" not in sites table (raw="${raw.siteId || raw.siteID}")`);
      ambiguous++;
      continue;
    }

    if (!mapped[required]) {
      log(`${name} ${mapped.id}: SKIP — missing required field "${required}"`);
      skipped++;
      continue;
    }

    verbose(`${name} ${mapped.id}: siteId=${mapped.siteId} ${required}="${mapped[required]}"`);

    if (!DRY_RUN) {
      // Strip undefined values — Prisma rejects them
      const data = Object.fromEntries(
        Object.entries(mapped).filter(([, v]) => v !== undefined)
      );
      // Ensure updatedAt is always set (Prisma @updatedAt doesn't apply on upsert create)
      data.updatedAt = data.updatedAt ? new Date(data.updatedAt) : now;

      await model().upsert({
        where:  { id: mapped.id },
        create: data,
        update: data,
      });
    }

    inserted++;
  }

  log(`${name}: ${DRY_RUN ? '[DRY RUN] would upsert' : 'upserted'} ${inserted}, skipped ${skipped}, ambiguous ${ambiguous}`);
  return { inserted, skipped, ambiguous };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting Phase C MASH relational backfill${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);

  const validSiteIds = await loadValidSiteIds();

  const totals = { inserted: 0, skipped: 0, ambiguous: 0 };

  for (const domain of DOMAINS) {
    if (!shouldRun(domain.name)) continue;
    const result = await backfillDomain(domain, validSiteIds);
    totals.inserted  += result.inserted;
    totals.skipped   += result.skipped;
    totals.ambiguous += result.ambiguous;
  }

  log('---');
  log(`Total: ${DRY_RUN ? 'would upsert' : 'upserted'} ${totals.inserted}, skipped ${totals.skipped}, ambiguous ${totals.ambiguous}`);

  if (totals.ambiguous > 0) {
    log('Ambiguous records have no siteId and cannot be migrated automatically.');
    log('Options: (a) assign siteId in JSON blob then re-run, (b) insert manually via psql.');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[backfill-mash] Fatal error:', err);
    process.exit(1);
  });
