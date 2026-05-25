# Site-Tenantization Architecture

**Status:** Phase A + B + C complete — 2026-05-23  
**Applies to:** SCORVA, MASH  
**Central identity:** HUB  
**Enterprise aggregation:** NEXUS

---

## 1. Tenant Model

**Authoritative tenant unit:** `siteId` — a stable site identifier string managed by HUB.

Sites are provisioned in the `Site` table. `siteId` on an operational record is a hard foreign key to that table, never a free-text string.

### User site scope (from HUB-issued token)

| Field | Type | Meaning |
|---|---|---|
| `siteId` | `string \| null` | User's primary site |
| `siteIds` | `string[]` | All sites the user can access |
| `canSeeAllSites` | `boolean` | May access cross-site or enterprise views |
| `securityRole` | `string \| null` | Operational role (drives app access and MASH wsRole) |

### `canSeeAllSites` definition

```
canSeeAllSites === true
  when user.siteIds.includes('MTSI-ALX')
  AND  (platformRole === 'Corporate Admin' OR securityRole === 'Corporate Security Admin')
```

This is computed by HUB (`packages/db/src/appAccess.js → canSeeAllSites`) and embedded in the JWT. Downstream apps must not recompute it — they must honor the flag. The `role === 'Corporate Admin'` fallback in middleware handles legacy tokens that predate the explicit flag.

### Scope behavior by user type

| User type | Read behavior | Write behavior |
|---|---|---|
| Single-site | Returns records for their `siteId` only | Can only write to their `siteId` |
| Multi-site | Returns records for any of their `siteIds` | Can write to any site in their `siteIds` |
| Enterprise (`canSeeAllSites`) | All-sites or specific site when requested | Can write to any site |
| No site assigned | Blocked (403) | Blocked (400/403) |

---

## 2. Data Ownership Classification

### HUB (central — no site scope)

| Entity | Notes |
|---|---|
| `User` | Central identity; carries `siteId/siteIds` as assignment metadata |
| `Site` | Authoritative site registry |
| `AccessRequest` | Platform-level approval workflow |
| Role/app constants | In-code (`appAccess.js`), not database tables |

### SCORVA (site-owned operational — Phase B: add `siteId` to all tables)

| Table / Model | Site-owned | Notes |
|---|---|---|
| `ATOPackage` | ✓ | |
| `POAM` | ✓ | |
| `Control` | ✓ | |
| `ConMon` | ✓ | |
| `Agreement` | ✓ | |
| `Workstation` | ✓ | |
| `YubiKey` | ✓ | |
| `License` | ✓ | |
| `AuditLog` | ✓ | |
| `Tracker` | ✓ | |
| `Task` | ✓ (when site-specific) | Global tasks (platform notifications) may have `siteId = null` |
| `Threat` | ✓ | |
| `User` (SCORVA copy) | Global | Identity owned by HUB; `siteId` is assignment, not scope filter |
| `Notification` | Global | Platform-wide; no site scope |

### MASH (site-owned operational — Phase C: migrate from JSON store to relational)

| Collection / Future Model | Site-owned | Notes |
|---|---|---|
| `facility_security` | ✓ | |
| `personnel_security` | ✓ | |
| `activities_security` | ✓ | |
| `document_control` | ✓ | |
| `media_control` | ✓ | |
| `self_inspection_ops` | ✓ | |
| `security_findings` | ✓ | |
| `security_workspace_settings` | Global (singleton) | Per-platform settings |
| `workspace_role_mappings` | Global (singleton) | Legacy fallback — being deprecated |

### NEXUS (enterprise — no direct site scope; reads from reporting views)

| Entity | Notes |
|---|---|
| Programs / contracts | Enterprise, cross-site |
| PM / executive dashboards | Aggregated from SCORVA + MASH reporting views |
| Rollup / summary views | Site attribution retained but not enforced as boundary |

---

## 3. Enforcement Architecture

### Tenant helper modules

Both SCORVA and MASH have a canonical `lib/tenantScope.js` module with these exports:

```js
getUserSiteScope(user)          // normalize site scope from any user object
resolveTenantScope(req)         // determine effective scope for a request
buildSiteWhere(scope, base)     // build Prisma WHERE clause from scope
assertSiteAccess(user, siteId)  // check if user can access a site
assertDocumentAccess(user, doc) // check if user can access a fetched record
isEnterpriseScopeRequest(req)   // is this an all-sites enterprise view?
resolveWriteSiteId(req)         // resolve + validate write target siteId
```

### SCORVA middleware stack

Route registration pattern:

```
app.use('/api/poam', requireAuth, tenantHandler, missionSiteScope, poamRouter);
```

| Middleware | Responsibility |
|---|---|
| `requireAuth` | Verify JWT; normalize site fields (both case variants); propagate `canSeeAllSites`, `securityRole` |
| `tenantHandler` | Multi-site scope: sets `req.applyTenantFilter()`, `req.assertTenantDocument()`, `req.resolveTenantSiteId()`, `req.tenantSiteIds` |
| `missionSiteScope` | Strict single-site scope for mission-critical data; enforces write-site selection |
| `siteScope` | **Deprecated** — session-based, no `canSeeAllSites` support. Do not use on new routes. |

Routes use the injected helpers directly:

```js
// Read
const docs = await db.poam.findMany({ where: req.applyTenantFilter({}) });

// Single-record access check
const doc = await db.poam.findUnique({ where: { id } });
if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });

// Write site resolution
const siteId = req.resolveTenantSiteId(req.body);
```

For complex routing logic, routes can also import `lib/tenantScope.js` directly.

### MASH enforcement (Phase A scaffolding)

MASH does not use Express middleware chains per route — all routes are on the monolithic `app`. The `auth` middleware normalizes the user payload (including `canSeeAllSites`), and the `lib/tenantScope.js` helpers are called inline in route handlers.

Pattern applied to all `/api/ws/:collection` routes:

```js
// Read
if (SITE_OWNED_COLLECTIONS.has(collection)) {
  const scope = resolveTenantScope(req);   // throws 403 if no site
  data = applyScopeFilter(data, scope);
}

// Create
if (SITE_OWNED_COLLECTIONS.has(collection)) {
  req.body.siteId = resolveWriteSiteId(req);  // validates + resolves
}

// Update / Delete
if (SITE_OWNED_COLLECTIONS.has(collection)) {
  if (!assertSiteAccess(req.user, record.siteId)) {
    return res.status(403).json({ error: 'Site access denied' });
  }
}
```

---

## 4. Schema Diff Drafts

### Phase B — SCORVA (Prisma schema additions)

**Status: Phase B implemented — 2026-05-23**

#### Audit results

All site-owned SCORVA models already have `siteId` columns. Phase B added the missing `@@index([siteId])` directives to 12 models and updated route enforcement.

| Model | `siteId` present | Type | Index added | Notes |
|---|---|---|---|---|
| `Control` | ✓ | `String` NOT NULL | ✓ Added | |
| `Task` | ✓ | `String` NOT NULL | ✓ Added | |
| `Poam` | ✓ | `String` NOT NULL | ✓ Added | |
| `AtoPackage` | ✓ | `String` NOT NULL | ✓ Added | |
| `ConMon` | ✓ | `String` NOT NULL | Already had `@@unique([siteId, controlId])` | |
| `Agreement` | ✓ | `String` NOT NULL | ✓ Added | |
| `SecurityEvent` | ✓ | `String` NOT NULL | ✓ Added | |
| `AuditLog` | ✓ | `String` NOT NULL | ✓ Added | No `Site` relation by design (append-only) |
| `Workstation` | ✓ | `String?` nullable | ✓ Added | Needs backfill before NOT NULL |
| `YubiKey` | ✓ | `String?` nullable | ✓ Added | Needs backfill before NOT NULL |
| `License` | ✓ | `String?` nullable | ✓ Added | No user FK — requires manual assignment |
| `Tracker` | ✓ | `String?` nullable | ✓ Added | Can be null for global/platform trackers |
| `Notification` | ✓ | `String?` nullable | ✓ Added | Global by design; nullable intentional |
| `EvidenceArtifact` | ✓ | `String?` nullable | Already had `@@index([siteId])` | Needs backfill before NOT NULL |
| `InspectionCampaign` | ✓ | `String` NOT NULL | Already had `@@index([siteId])` | |

#### Migration

`packages/db/prisma/migrations/20260523100000_phase_b_site_tenant_indexes/migration.sql`

Adds `CREATE INDEX IF NOT EXISTS` for all 12 models. **Codex deployment note:** run each statement with `CONCURRENTLY` on production to avoid table locks on live traffic.

#### Backfill script

`scorva-v1/server/scripts/backfillSiteId.js`

```
node backfillSiteId.js --dry-run          # preview changes, no writes
node backfillSiteId.js                     # apply updates
node backfillSiteId.js --model=Workstation,YubiKey --verbose
```

Inference strategy per model:

| Model | Strategy | Ambiguous if |
|---|---|---|
| `Workstation` | `username` → `User.siteId` | no matching user, or user has multiple sites |
| `YubiKey` | `username` → `User.siteId` | same |
| `Tracker` | `createdBy` → `User.siteId` | same |
| `EvidenceArtifact` | `uploadedBy` → `User.siteId` | same |
| `License` | No user FK | Always ambiguous — manual assignment required |

#### Route enforcement fix

`trackers.js` was using the old `req.siteFilter` pattern (a legacy single-site scalar from `tenantHandler`). This silently dropped multi-site users to first-site-only reads and would deny them access to records from their other assigned sites. Updated to Phase A helpers (`req.applyTenantFilter`, `req.assertTenantDocument`, `req.resolveTenantSiteId`).

#### Codex production verification checklist

Before making nullable `siteId` columns NOT NULL (Phase B step 4):

1. Run `backfillSiteId.js --dry-run` on production — confirm ambiguous count is 0 or acceptable
2. Run `backfillSiteId.js` to apply inferred assignments
3. For ambiguous `License` records: use SCORVA admin UI or direct SQL to assign `siteId`
4. Verify: `SELECT COUNT(*) FROM workstations WHERE site_id IS NULL` → expect 0
5. Verify: `SELECT COUNT(*) FROM yubi_keys WHERE site_id IS NULL` → expect 0
6. Verify: `SELECT COUNT(*) FROM licenses WHERE site_id IS NULL` → expect 0
7. Verify: `SELECT COUNT(*) FROM trackers WHERE site_id IS NULL AND created_by IS NOT NULL` → expect 0
8. Once all 0: run a follow-up migration to add `NOT NULL` constraints and `Site` relation FKs where missing

### Phase C — MASH (new relational models replacing JSON store)

**Status: Phase C implemented — 2026-05-23**

#### What was done

The 7 site-owned MASH domains were migrated from JSON blob storage (`MashCollection`) to proper Prisma relational tables. All tables have `siteId NOT NULL` enforced from the start and a `@@index([siteId])`.

| Domain | Prisma model | Table |
|---|---|---|
| `facility_security` | `MashFacilitySecurity` | `mash_facility_security` |
| `personnel_security` | `MashPersonnelSecurity` | `mash_personnel_security` |
| `activities_security` | `MashActivitiesSecurity` | `mash_activities_security` |
| `document_control` | `MashDocumentControl` | `mash_document_control` |
| `media_control` | `MashMediaControl` | `mash_media_control` |
| `self_inspection_ops` | `MashSelfInspectionOp` | `mash_self_inspection_ops` |
| `security_findings` | `MashSecurityFinding` | `mash_security_findings` |

Key scalar fields are top-level columns (name, status, siteId, etc.). Complex nested structures (kmp, training, accreditation, foreignTravel, history, waivers, etc.) remain as JSONB fields — Prisma returns these as plain JS objects, so existing aggregation logic works without changes.

#### Prisma schema pattern

All 7 models follow this pattern (shown for facility):

```prisma
model MashFacilitySecurity {
  id     String @id @default(cuid())
  siteId String @map("site_id")
  site   Site   @relation(fields: [siteId], references: [id])
  name   String
  status String @default("Active")
  // ... scalar columns ...
  kmp    Json?  @default("[]")
  // ... JSONB columns ...
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")
  createdBy String?  @map("created_by")
  updatedBy String?  @map("updated_by")

  @@index([siteId])
  @@map("mash_facility_security")
}
```

#### Migration

`packages/db/prisma/migrations/20260523200000_phase_c_mash_relational/migration.sql`

Creates all 7 tables with JSONB columns and TIMESTAMPTZ timestamps. **Codex deployment note:** run each `CREATE INDEX` with `CONCURRENTLY` on production to avoid table locks.

#### Data access layer

`security-dashboard/lib/mashDb.js`

Exports:
- `RELATIONAL_DOMAINS` — Set of the 7 domain names
- `DOMAIN_MODEL` — Map from collection name → Prisma client accessor key
- `buildWhere(scope, base)` — builds Prisma WHERE clause from tenant scope
- `findMany(collection, scope)` — scoped list
- `findById(collection, id)` — single record
- `create(collection, data)` — insert
- `update(collection, id, data)` — patch
- `remove(collection, id)` — delete
- `aggregateOverview(scope)` → `{ facilities, personnel, activities, docs, media, findings, inspections }`

#### Route changes (`security-dashboard/server.js`)

All 5 `/api/ws/:collection` handlers now check `RELATIONAL_DOMAINS.has(collection)` first and branch to `mashDb.*` before falling through to the JSON store path:

| Route | Relational branch |
|---|---|
| `GET /api/ws/:collection` | `mashDb.findMany(collection, resolveTenantScope(req))` |
| `POST /api/ws/:collection` | `mashDb.create(collection, {...body, siteId: resolveWriteSiteId(req)})` |
| `PUT /api/ws/:collection` | Returns `405 — Use POST/PATCH for relational domains` |
| `PATCH /api/ws/:collection/:id` | `findById` → `assertSiteAccess` → `mashDb.update(...)` |
| `DELETE /api/ws/:collection/:id` | `findById` → `assertSiteAccess` → `mashDb.remove(...)` |

The overview route (`GET /api/workspace/overview`) uses `mashDb.aggregateOverview(scope)` in production (when `DATABASE_URL` is set) and falls back to `readCollectionSafe` + `siteFilter` in no-DB dev mode.

#### Backfill script

`security-dashboard/scripts/backfillMashRelational.js`

Reads each JSON blob from `MashCollection` via `readCollection`, maps fields to relational schema, and upserts by `record.id` (idempotent).

```
node backfillMashRelational.js --dry-run               # preview, no writes
node backfillMashRelational.js                         # apply
node backfillMashRelational.js --domain=facility_security,media_control --verbose
```

Records without `siteId` are logged as ambiguous and skipped. Options: assign `siteId` in the JSON blob and re-run, or insert manually via psql.

#### Codex production deployment sequence

1. Apply migration: `prisma migrate deploy`
2. Run backfill dry-run: `node security-dashboard/scripts/backfillMashRelational.js --dry-run`
3. Verify ambiguous count is 0 or resolve via psql
4. Run backfill: `node security-dashboard/scripts/backfillMashRelational.js`
5. Verify row counts per table match blob record counts:
   ```sql
   SELECT COUNT(*) FROM mash_facility_security;
   SELECT COUNT(*) FROM mash_personnel_security;
   -- etc.
   ```
6. Deploy new application image — routes now read from relational tables
7. After one sprint of validation: drop JSON blob records for the 7 migrated domains from `mash_collections`
8. Retain `mash_collections` rows for `security_workspace_settings` and `workspace_role_mappings`

---

## 5. Developer Guide — Writing a New Route Correctly

### SCORVA

All operational routes must be registered with `requireAuth` + `tenantHandler` as minimum:

```js
// index.js
app.use('/api/my-thing', requireAuth, tenantHandler, myThingRouter);
// or for strict mission-app data:
app.use('/api/my-thing', requireAuth, tenantHandler, missionSiteScope, myThingRouter);
```

In the route file:

```js
// Read all
router.get('/', async (req, res, next) => {
  const docs = await db.myThing.findMany({ where: req.applyTenantFilter({}) });
  res.json(docs);
});

// Read one
router.get('/:id', async (req, res, next) => {
  const doc = await db.myThing.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (!req.assertTenantDocument(doc)) return res.status(403).json({ error: 'Forbidden' });
  res.json(doc);
});

// Create
router.post('/', async (req, res, next) => {
  const siteId = req.resolveTenantSiteId(req.body);
  const doc = await db.myThing.create({ data: { ...req.body, siteId } });
  res.status(201).json(doc);
});
```

**Never** do:
```js
// BAD — no site filter; reads all tenant data
const docs = await db.myThing.findMany({});

// BAD — uses client-supplied siteId without validation
const docs = await db.myThing.findMany({ where: { siteId: req.query.siteId } });
```

### MASH

For site-owned collections in route handlers, always resolve scope before returning data:

```js
// Read — use applyScopeFilter or resolveTenantScope directly
if (SITE_OWNED_COLLECTIONS.has(collection)) {
  const scope = resolveTenantScope(req);
  data = applyScopeFilter(data, scope);
}

// Create — resolve and validate write site
if (SITE_OWNED_COLLECTIONS.has(collection)) {
  req.body.siteId = resolveWriteSiteId(req);
}

// Update / Delete — check ownership of the existing record
if (SITE_OWNED_COLLECTIONS.has(collection) && !assertSiteAccess(req.user, record.siteId)) {
  return res.status(403).json({ error: 'Site access denied' });
}
```

---

## 6. Open Risks for Phase B and Phase C

### Phase B (SCORVA)

| Risk | Mitigation |
|---|---|
| Some SCORVA tables may already have `siteId` under a different column name (`siteID`, `site`) | Audit each Prisma model before migration; standardize to `siteId` |
| Records from before multi-site support may have missing `siteId` | Backfill script; use known SAAR/YubiKey assignment data as ground truth |
| `Control` records (NIST catalog items) may be global by intent | Decide whether controls are site-specific instantiations or global catalog; if global, mark `siteId` nullable |
| AuditLog records reference other models — if those models move to `siteId`, log query may need a join | Add `siteId` to `AuditLog` directly at creation time |

### Phase C (MASH)

| Risk | Mitigation |
|---|---|
| JSON store has freeform record structure — relational model must accommodate all existing field shapes | Audit current MASH client field usage before defining Prisma models |
| Some existing JSON records may not have `siteId` (created before site scope existed) | Backfill using workspace settings or admin-driven assignment |
| MASH frontend currently passes `siteId` as a query param — this behavior becomes unnecessary after Phase C | Remove or ignore client-supplied `siteId` on reads once backend enforces scope; update client to not pass it |
| Dual-read sprint (JSON + relational) adds code complexity | Keep dual-read period to exactly one sprint; have clear cutover criteria |

### Both phases

| Risk | Mitigation |
|---|---|
| Developer adds a new route without tenant filter | Phase F: Prisma middleware extension that warns on unscoped queries in dev; CI cross-site leakage tests |
| Enterprise view returns mixed-site data without per-record `siteId` annotation | Always include `siteId` in API responses for site-owned records; NEXUS and enterprise UIs should use it for provenance display |

---

## 7. Phase D — Runtime Integration Fixes and NEXUS Alignment

Completed after Phase C code-complete. These were post-migration production readiness fixes discovered
during integration testing; no schema changes.

### 7.1 MASH Runtime Integration Findings

Three compounding bugs caused the deployed app to show empty pages and "Overview unavailable"
even after Phase C relational tables were populated:

**Bug 1 — Overview 500 masking 403**

`resolveTenantScope` throws `{ status: 403, message: '...' }` when a user has no site assignments.
The overview route catch block was always sending HTTP 500:

```js
// Before
} catch (err) {
  res.status(500).json({ error: err.message });
}

// After
} catch (err) {
  const status = err.status || 500;
  console.error('[overview]', { user: req.user?.username, siteIds: req.user?.siteIds, status, message: err.message });
  res.status(status).json({ error: err.message || 'Overview aggregation failed' });
}
```

The structured log (`user`, `siteIds`, `status`) lets you distinguish "user has no site assigned"
(403 → admin fix) from "database query failed" (500 → code/infra fix) in production logs.

**Bug 2 — Missing `activities` object in overview response**

`OverviewPage.jsx` destructures `data.activities` but the server never sent that key.
Added to the `/api/workspace/overview` response:

```js
activities: {
  total: act.length,
  scheduled: act.filter(a => ['Planned', 'Scheduled'].includes(a.status)).length,
  openIssues: act.filter(a => !['Completed', 'Cancelled'].includes(a.status)).length,
},
```

**Bug 3 — WS.get silently discarded non-200 responses**

All six collection pages called `WS.get(...)` and checked `Array.isArray(d) ? d : []`.
When the API returned `{ error: 'Site access denied' }` with HTTP 403, the page rendered empty
with no feedback. Fixed by introducing a discriminated error sentinel:

```js
// app.js — WS.get, WS.post, WS.patch, WS.del
if (!r.ok) return { _wsError: true, status: r.status, message: body?.error || 'Request failed' };
```

All six pages (`FacilityPage`, `PersonnelPage`, `ActivitiesPage`, `DocumentsPage`, `MediaPage`,
`InspectionsPage`) now check `d?._wsError` and surface the error message instead of an empty list.
`OverviewPage` uses a parallel `_overviewError` sentinel with a human-readable 403 hint:

```
Your account has no site access assigned. Contact your administrator.
```

### 7.2 MASH Backfill Script Fixes

Phase C shipped with three field-name bugs discovered during code review:

| Bug | Field | Fix |
|---|---|---|
| Prisma field `caveatAccess`, not `caveaAccess` | `mapPersonnel` | Renamed + read fallback `r.caveatAccess ?? r.caveat_access ?? []` |
| Prisma field `capacityGB` (uppercase), not `capacityGb` | `mapMedia` | Chain: `r.capacityGB ?? r.capacityGb ?? r.capacity_gb ?? null` |
| `required: 'id'` guard for `media_control` was a no-op (every record gets an id) | `backfillMashRelational.js` domains config | Changed to `required: 'mediaId'` |

Additionally added two production-readiness capabilities:

**Legacy site ID mapping (`--site-map=<path>`):** Seed data uses short IDs (`site-001`, `site-002`,
`lincolnia-hq`, `maryland-warehouse`) that differ from production `sites.id` UUIDs. The backfill
now accepts a JSON mapping file:

```
node scripts/backfillMashRelational.js --site-map=./site-id-map.json
```

**Preflight site validation:** At startup, `loadValidSiteIds()` queries `db.site.findMany` and
builds a Set. After `resolveSiteId()` maps legacy IDs, records whose `siteId` is still not in the
Set are logged as `AMBIGUOUS` and skipped rather than failing at Prisma FK constraint:

```
[backfill-mash] facility abc123: AMBIGUOUS — unresolved siteId "site-003" not in sites table
```

A test suite (`security-dashboard/__tests__/backfillMashRelational.test.js`) covers 30 cases:
`resolveSiteId`, `isValidSite`, `mapPersonnel` name/person fallback, `mapMedia` capacity chain,
and all four legacy seed ID translations.

### 7.3 SCORVA Tenantization — `sites.js` Access Control Fix

A full audit of all 23 SCORVA route files found that the eight Phase B priority routes were already
fully enforced with Phase A helpers (`applyTenantFilter`, `assertTenantDocument`,
`resolveTenantSiteId`). However, the audit also found one previously unaddressed route:

**`sites.js` — critical gap (now fixed):**

`GET /api/sites`, `POST /api/sites`, `PATCH /api/sites/:id`, and `DELETE /api/sites/:id` were
mounted with `requireAuth` only. Any authenticated user could enumerate all sites and mutate the
sites table.

Additional bug: mutation handlers called `req.session.user.username` (old session-based pattern)
instead of `req.user.username` (JWT pattern), meaning audit log calls would have silently logged
`null` as the actor in production.

**Fixed in `scorva-v1/server/routes/sites.js`:**

```js
function requireCorporateAdmin(req, res, next) {
  if (req.user?.role !== 'Corporate Admin') {
    return res.status(403).json({ error: 'Forbidden — Corporate Admin only' });
  }
  next();
}

// GET — Corporate Admin sees all sites; site-scoped users see only their assigned sites
router.get('/', async (req, res, next) => {
  const isCorporateAdmin = req.user?.role === 'Corporate Admin' || req.user?.canSeeAllSites;
  if (isCorporateAdmin) {
    res.json(await db.site.findMany({ orderBy: { id: 'asc' } }));
  } else {
    const siteIds = Array.isArray(req.user?.siteIds) ? req.user.siteIds.filter(Boolean) : [];
    if (siteIds.length === 0) return res.json([]);
    res.json(await db.site.findMany({ where: { id: { in: siteIds } }, orderBy: { id: 'asc' } }));
  }
});

// POST / PATCH / DELETE — Corporate Admin only
router.post('/', requireCorporateAdmin, ...);
router.patch('/:id', requireCorporateAdmin, ...);
router.delete('/:id', requireCorporateAdmin, ...);
// All mutation handlers now use req.user.username (not req.session.user)
```

**Full route status after Phase D:**

| Route | Status | Notes |
|---|---|---|
| `poam.js` | Enforced | Phase B |
| `workstations.js` | Enforced | Phase B |
| `yubikeys.js` | Enforced | Phase B |
| `agreements.js` | Enforced | Phase B |
| `licenses.js` | Enforced | Phase B |
| `evidence.js` | Enforced | Phase B |
| `security-events.js` | Enforced | Phase B |
| `notifications.js` | Enforced | Phase B |
| `sites.js` | Enforced | Fixed Phase D — GET scoped by role; mutations Corporate Admin only |
| `aggregate.js` | Intentionally global | Corporate Admin gate + per-site queries inside |
| `threats.js` | Intentionally global | External NVD CVE proxy; no tenant data |
| `checklist.js` | Intentionally global | NIST template catalog; no siteId field |

A test suite (`scorva-v1/__tests__/sitesRoute.test.js`, 15 tests) covers `requireCorporateAdmin`
behavior and the GET filtering logic across all role/siteIds combinations.

### 7.4 NEXUS Alignment — Tenant-Safe Rollup

`buildCyberRollup()` in `nexus/server.js` was performing unfiltered Prisma queries across all
sites. Any authenticated NEXUS user could see ATO packages, POA&Ms, users, workstations, SAARs,
system requests, and assets for all sites.

Fixed by adding a `viewer` parameter and computing `siteFilter` before all seven queries:

```js
async function buildCyberRollup(viewer) {
  const canSeeAll = !viewer || viewer.role === 'Corporate Admin' ||
    Boolean(viewer.canSeeAllSites);
  const siteFilter = (!canSeeAll && Array.isArray(viewer?.siteIds) && viewer.siteIds.length)
    ? { siteId: { in: viewer.siteIds } }
    : {};
  // ... all 7 findMany calls use { where: siteFilter }
}
```

Both call sites (`/api/bootstrap` and `/api/cyber-rollup`) updated to pass `req.user`.

**Enterprise users** (`Corporate Admin` or `canSeeAllSites: true`): unfiltered — see all sites.
**Site-scoped users**: filtered to `viewer.siteIds` — see only their assigned sites.

This is alignment groundwork only. Full NEXUS tenantization (per-collection write scoping,
site-aware settings, admin UI) is tracked as a future phase.

### 7.5 Production Verification Checklist

These items cannot be verified without access to the Azure GovCloud environment. Confirm before
declaring Phase D production-complete:

- [ ] JWT tokens for site-scoped users include a `siteIds` array whose values match real `sites.id`
  UUIDs (not legacy short IDs like `site-001`)
- [ ] `GET /api/workspace/overview` returns HTTP 200 with data for a user with valid `siteIds`
- [ ] `GET /api/workspace/overview` returns HTTP 403 (not 500) for a user with empty `siteIds`
- [ ] Collection pages (`/api/ws/facility_security`, etc.) return non-empty arrays for users with
  valid `siteIds`
- [ ] NEXUS `/api/bootstrap` returns only site-scoped data when called with a site-scoped token
- [ ] Backfill was run with `--site-map` pointing to a file mapping legacy seed IDs to production
  `sites.id` values; confirm zero `AMBIGUOUS` log lines for records that should have been migrated

---

## 8. Phase E — NEXUS Completion Sprint

This phase converts NEXUS from a dashboard shell with seeded placeholder data into a functional
program command app with three real data domains.

### 8.1 Auth / Site Context Fix

`mapHubUser()` now preserves all fields needed for correct tenant-aware behavior:

```js
return {
  // ... existing fields ...
  canSeeAllSites: Boolean(hubUser.canSeeAllSites) || isCorporateAdmin,
  securityRole: hubUser.securityRole || null,
  authVersion: 2,
};
```

`canSeeAllSites` was previously missing from the NEXUS token payload, causing enterprise users
who authenticated via HUB to be incorrectly treated as site-scoped. `authVersion` bumped to 2 to
distinguish old tokens (which lack `canSeeAllSites`) from new ones.

**SSO flow:** The client still decodes the `nexus_token` URL param client-side (no server
round-trip needed since the token is already signed by NEXUS). No change required.

### 8.2 Program Management Admin Console

A full CRUD admin surface was added at `/admin` (visible in the nav for Corporate Admin and
Program Manager roles only).

**Server routes added:**

| Method | Path | Description |
|---|---|---|
| `PUT` | `/api/admin/pm/portfolio` | Update fiscal year, budget totals, name |
| `PUT` | `/api/admin/pm/kpis/:id` | Upsert a single KPI card |
| `POST` | `/api/admin/pm/:section` | Add item to realEstate / construction / accreditations / milestones |
| `PUT` | `/api/admin/pm/:section/:id` | Update item in array section |
| `DELETE` | `/api/admin/pm/:section/:id` | Delete item from array section |
| `PUT` | `/api/admin/settings` | Update nexus app settings (name, hero text) |

All admin routes require `requireAdminRole` middleware (Corporate Admin or Program Manager).
The existing `PUT /api/program-management` is also now gated by `requireAdminRole`.

**Client:** New `AdminPage.jsx` provides tabbed CRUD interfaces for all PM sections. The admin
console calls the granular endpoints above so changes are immediately reflected on the dashboard.
The `ProgramManagementPage` remains read-only; the admin surface is the only write path.

**Data boundary:** Program Management data remains in the `program_management` pg-store collection
(JSON blob). The admin surface provides intentional, structured edit access.

### 8.3 Program Security — Live MASH Rollup

`buildSecurityRollup(viewer)` added to `nexus/server.js`. It reads four MASH relational tables
with the same tenant-scoping as `buildCyberRollup`:

| Prisma Model | Rollup Output |
|---|---|
| `MashFacilitySecurity` | Facility posture counts (nominal/guarded/elevated), site list with open issue summary |
| `MashPersonnelSecurity` | Training compliance, visit access request queue, clearance breakdown |
| `MashActivitiesSecurity` | Category/open-item summaries |
| `MashSecurityFinding` | Open finding count, high finding count |

The bootstrap uses a try/catch to prefer the live rollup; on error it falls back to the stored
`program_security` collection, or to `{ _source: 'unavailable' }` if neither is available.

```js
// Bootstrap selects data source automatically
programSecurity: securitySource,  // 'live' | 'stored' | 'unavailable'
```

A `DataSourceBanner` component in `App.jsx` shows a visible warning when `programSecurity` is
`stored` or `unavailable`, so operators know the data is stale rather than live.

**Training date flexibility:** The `training` JSON field in `MashPersonnelSecurity` has no fixed
schema. `buildSecurityRollup` checks four common field names:
`trainingDue`, `annualReviewDue`, `dueDate`, `annualBriefingDue`.

### 8.4 IT/Cybersecurity — Security Events Added

`buildCyberRollup` now queries `db.securityEvent` (8th parallel query, last 100 events by
`createdAt` desc). Added `securityEvents` object to the return value:

```js
securityEvents: {
  total, open, criticalHigh,
  bySeverity: { Critical, High, Medium, Low },
  recent: [ { id, type, severity, status, siteId, createdAt } ],
}
```

`ProgramCyberPage.jsx` renders a Security Events section (shown only when `secEvents.total > 0`)
with a stat grid, recent events list, and severity donut chart. A critical/high events KPI card is
added to the top strip when `secEvents.criticalHigh > 0`.

### 8.5 Data Boundaries (Editable vs Derived)

| Data | Source | Who Can Edit | Notes |
|---|---|---|---|
| Program Management (portfolio, KPIs, construction, etc.) | pg-store collection | Corporate Admin, Program Manager | Via `/admin` console |
| App Settings (name, hero text) | pg-store collection | Corporate Admin, Program Manager | Via `/api/admin/settings` |
| Program Security | **MASH relational tables** (live) | MASH operational users | NEXUS reads only; edit in MASH |
| IT/Cybersecurity | **SCORVA relational tables** (live) | SCORVA operational users | NEXUS reads only; edit in SCORVA |

### 8.6 Client Error Handling

- `API.get/put/post/del` now return `{ _apiError: true, status, message }` on non-200.
- `App.jsx` bootstrap load handles `_apiError` with a human-readable hint (403 → access denied,
  other → server error message).
- `ProgramCyberPage` renders an explicit "unavailable" state if `data._error` is set.
- `DataSourceBanner` surfaces partial-data warnings inline above page content.

### 8.7 Production Verification Checklist — Phase E

- [ ] HUB user tokens for existing sessions will be missing `canSeeAllSites` (authVersion 1). Users
  must re-authenticate after the NEXUS deploy to receive a new token (authVersion 2)
- [ ] Verify Corporate Admin users see unfiltered enterprise rollup in all three dashboard sections
- [ ] Verify site-scoped users see only their `siteIds` in security and cyber rollups
- [ ] Confirm `GET /api/bootstrap` → `_sources.programSecurity === 'live'` once MASH tables are
  populated with Phase C backfill data
- [ ] Verify admin console (`/admin`) is only visible and accessible to Corporate Admin / Program
  Manager roles
- [ ] Confirm `PUT /api/program-management` from a Viewer-role token returns 403
- [ ] Check that `buildSecurityRollup` training detection finds the correct date field name used in
  your production `MashPersonnelSecurity.training` JSON (four variants checked)

---

## 9. Phase F — LAVA Compatibility and Hardening Sprint

Completed 2026-05-24. Brings LAVA into alignment with the current shared Prisma/PostgreSQL stack,
the centralized HUB role/site model, and the security conventions established in Phases B–E.

No new Prisma migrations were required. All LAVA models (`LavaSaar`, `LavaSystemRequest`,
`LavaAsset`, `LavaAssetAssignmentHistory`, `LavaAuditLog`) are code-aligned with the existing
schema, including the lifecycle fields from migration `20260524223000_lava_saar_access_lifecycle_fields`.

### 9.1 Auth/Session Model Changes

**Files changed:** `lava/server/routes/auth.js`

LAVA session objects now carry the full modern identity shape used across the platform:

| Field | Before | After |
|---|---|---|
| `id`, `name`, `username`, `email` | ✓ | ✓ |
| `role` | ✓ | ✓ |
| `securityRole` | ✗ missing | ✓ from HUB SSO or null |
| `siteId`, `siteIds` | ✓ | ✓ |
| `canSeeAllSites` | ✗ missing | ✓ derived or from HUB SSO |
| `title` | ✗ missing | ✓ from local DB user |

A `buildSessionUser(localUser, hubUser)` helper centralizes the shape so local login and HUB SSO
produce an identical object.

**SSO path:** `securityRole` and `canSeeAllSites` are now taken from the HUB-returned `data.user`
(the platform source of truth), not from the local DB user (which does not have those fields).

**Local login path:** `securityRole` defaults to `null`; `canSeeAllSites` is derived from
`role === 'Corporate Admin'` since the local DB `User` model has no `canSeeAllSites` column.

### 9.2 Authorization Model Changes

**Files changed:** `lava/server/authz.js`, `lava/client/src/context/AuthContext.jsx`

The legacy `VULCAN_ROLES = Set(['Corporate Admin', 'Site Admin', 'Admin', 'Vulcan'])` role check
was replaced with an explicit three-tier access model:

| Tier | Field checked | Values | Access level |
|---|---|---|---|
| Platform admin | `user.role` | `Corporate Admin`, `Site Admin`, `Admin` | Full LAVA operator |
| Security role operator | `user.securityRole` | `Information Technology`, `Information Security` | LAVA operational access |
| Legacy compatibility | `user.role` | `Vulcan` | Retained during migration period |

New exports from `authz.js`:
- `isVulcanUser(req)` — checks all three tiers
- `requireVulcan(req, res, next)` — 403 if not a LAVA operator
- `isCorporateAdmin(req)` — platform admin check
- `requireCorporateAdmin(req, res, next)` — reserved for future Corporate Admin-only routes

`AuthContext.jsx` `isVulcan` now mirrors the same three-tier logic so the client and server stay
in sync. Previously the client used only the four-value legacy set.

### 9.3 Site-Aware Behavior

**Files changed:** `lava/server/authz.js`, `lava/server/routes/saar.js`,
`lava/server/routes/systems.js`, `lava/server/routes/hardware.js`

**Rule:**

- `Corporate Admin` or `canSeeAllSites` users: no site restriction (see and mutate all records).
- Site-scoped users: list views filtered to their `siteIds`; enterprise-scope records
  (`siteId IS NULL`) visible to all.
- Users with no site context at all: only enterprise-wide (`siteId IS NULL`) records — not all.
- All mutations (including SAAR approve/provision/lifecycle) assert site scope on the pre-fetched
  record before writing.

**Shared helper — `isSiteAllowed(viewer, recordSiteId)` in `authz.js`:**
- `null`/`undefined` `recordSiteId` → always allowed (enterprise-wide record).
- `Corporate Admin` / `canSeeAllSites` → always allowed.
- Otherwise: `recordSiteId` must be in the viewer's `siteIds` (or equal to `siteId`).
- Exported and used by all three route files for consistent enforcement.

**SAAR routes (`saar.js`):**
- `buildSiteFilter(viewer)` scopes list queries; no-site users get `{ id: { in: [] } }` (empty).
- `GET /`, `GET /meta/stats` apply the site filter.
- `GET /:id` — `isSiteAllowed` check after fetch.
- `PATCH /:id/status` (approve/reject) — fetches record first, asserts site scope, then updates.
- `PATCH /:id/provision` — fetches record first, asserts site scope, then updates.
- `PATCH /:id/lifecycle` — asserts site scope on the existing record before applying updates.
- `POST /` (public submission) — no session, no filter. `submittedBy` set to applicant email.

**Systems routes (`systems.js`):**
- `buildSiteFilter` fixed: no-site-context users now get `{ siteId: null }` (enterprise-only),
  not `null → where: {}` (all records).
- `GET /` applies site filter including `OR siteId IS NULL`.
- `GET /:id` — `isSiteAllowed` check after fetch.
- `PATCH /:id/status` — fetches record first, asserts site scope, then updates.
- `POST /` assigns `siteId` from the authenticated user's session.

**Hardware routes (`hardware.js`):**
- `POST /upload/:systemId` — fetches parent system, asserts `isSiteAllowed` on its `siteId`.
- `GET /` — when `systemId` query param is present, fetches parent system and asserts site scope.
- `PATCH /:id` — asserts `isSiteAllowed` on the existing asset's `siteId` before update.
- `DELETE /:id` — fetches record first, asserts site scope, then deletes (previously deleted
  without a pre-flight fetch, so no scope check was possible).
- Bulk-imported assets receive the uploader's `siteId` on creation.

### 9.4 SAAR Workflow Changes

- `submittedBy` field (schema-present but never set) is now populated on public SAAR submission
  using the applicant's email address.
- `actor(req)` in `audit.js` correctly derives identity from `req.session.user` for all audit log
  entries — no JWT/session mismatch since LAVA is exclusively session-auth.
- All lifecycle fields (`accessExpiresAt`, `revalidationDueAt`, `revokedAt`, `revokedBy`,
  `revocationReason`) are already correct and aligned with the schema.

### 9.5 Client Error Handling Changes

**Files changed:** `lava/client/src/pages/SystemRequest.jsx`

- `handleDeleteAsset` now surfaces the actual server error message in the toast
  (`err?.response?.data?.error`) instead of the generic "Failed to remove asset".
- `loadSystems` now shows the server error in a toast on failure instead of silently logging
  to console.

### 9.6 Schema / Migration Status

No new migration files were added in this sprint. All LAVA code is aligned with the existing schema:

| Model | Fields verified | Status |
|---|---|---|
| `LavaSaar` | All lifecycle fields, `submittedBy`, `reviewedBy`, `provisionedBy` | ✓ Aligned |
| `LavaSystemRequest` | `siteId`, `reviewedBy`, `reviewNotes` | ✓ Aligned |
| `LavaAsset` | `siteId`, `systemRequestId` FK | ✓ Aligned |
| `LavaAssetAssignmentHistory` | `assetId` FK, `returnedAt`, `assignedBy` | ✓ Aligned |
| `LavaAuditLog` | `siteId`, `actor`, `entityId` | ✓ Aligned |

### 9.7 Codex Production Verification Checklist — Phase F

- [ ] After deploy, verify that HUB SSO callback populates `securityRole` in the LAVA session:
  log in via HUB SSO and confirm `/auth/me` returns a session with `securityRole` field set
- [ ] Confirm that a user with `securityRole: 'Information Technology'` can reach Vulcan Command
  and that a Viewer-role user without IT/IS security role is blocked (403)
- [ ] Verify site-scoped SAAR filter: an operator with `siteIds: ['site-abc']` should see only
  SAARs where `siteId = 'site-abc'` (list returns no cross-site SAARs)
- [ ] Verify cross-site SAAR mutation is blocked: a site-scoped operator trying to approve/provision
  a SAAR from a different site should receive 403, not a successful update
- [ ] Verify `POST /api/systems` sets `siteId` from the logged-in user's session (check DB)
- [ ] Verify `GET /api/systems/:id` returns 403 for a site-scoped user accessing a different site's
  system record
- [ ] Verify `PATCH /api/systems/:id/status` returns 403 for a cross-site attempt
- [ ] Verify bulk hardware upload returns 403 if the target `systemId` belongs to a different site
- [ ] Confirm `PATCH /api/hardware/:id` and `DELETE /api/hardware/:id` return 403 for cross-site
  asset access
- [ ] Verify bulk hardware upload sets `siteId` on imported assets
- [ ] Confirm `DELETE /api/hardware/:id` returns 403 for a non-operator (Viewer-role) session
- [ ] SAAR public submission: confirm `submittedBy` column is populated with the applicant's email
  on new SAAR records
- [ ] Check existing SAARs/systems/assets with `siteId IS NULL` are still visible to all operators
  (null-siteId records = enterprise-wide, must not be hidden)
- [ ] Verify that a session with no `siteId` or `siteIds` sees only null-siteId systems (enterprise-
  wide), not all systems
