# NEXUS Phase Next — Data Model and Dashboard Plan
**Date:** 2026-06-05  
**Author:** Claude  
**Scope:** NEXUS data/rollup/dashboard only — no MASH, HUB, or auth changes  
**Reference:** `nexus-phase-next-execution-brief-2026-06-05.md`, `docs/site-tenantization.md`

---

## A. Current-State Inventory

### A.1 Program Management — `program_management` pg-store collection

| Attribute | Detail |
|---|---|
| Route | `GET /api/program-management`, `PUT /api/program-management`, `PUT /api/admin/pm/*` |
| Storage | `MashCollection` row named `program_management` (JSON blob in `mash_collections` table) |
| Live or stored | Stored — manually edited via Admin console |
| Site-scoped | No — enterprise-wide by design |
| Sufficient for leadership | **Partial.** Data is correct but entirely hand-entered. No automatic computation from SCORVA or MASH. KPIs (budget health, accreditation count) are updated manually. |

Current JSON shape in `nexus/data/program_management.json` (seeded on first start):
```
portfolio: { name, fiscalYear, budgetTotal, budgetObligated, budgetRemaining, kpis[] }
realEstate: [ { id, site, type, status, dueDate, owner } ]
construction: [ { id, name, type, status, progress, budget, schedule, accreditation } ]
accreditations: [ { id, name, level, status, targetDate } ]
milestones: [ { id, title, date, status } ]
```

**Gaps:** No risks, no leadership action tracker, no contract/spend linkage, no burn-rate, no auto-update from live sources.

---

### A.2 Program Security — `buildSecurityRollup(viewer)` in `nexus/server.js`

| Attribute | Detail |
|---|---|
| Route | `GET /api/security-rollup`, included in `GET /api/bootstrap` as `programSecurity` |
| Storage | Live Prisma queries → falls back to stored `program_security` pg-store collection |
| Live or stored | Live when MASH tables are populated; `_source: 'stored'` or `'unavailable'` otherwise |
| Site-scoped | Yes — `siteFilter: { siteId: { in: viewer.siteIds } }` or `{}` for enterprise |
| Sufficient for leadership | **Partial.** Covers facilities, personnel, and activities at a summary level. Three MASH domains are not queried at all. |

**Currently queried MASH models:**

| Prisma model | Fields selected | Rollup output | Gap |
|---|---|---|---|
| `MashFacilitySecurity` | All fields (no select) | Posture counts (nominal/guarded/elevated), site list with open issue count | Does not surface IDS alarms, compliance score trends, or FCL expiration |
| `MashPersonnelSecurity` | All fields | Training compliance, VAR queue, clearance breakdown | Training date detection reads 4 JSONB field name variants (fragile). No clearance PRD expiration tracking. No foreign-travel debrief backlog count. |
| `MashActivitiesSecurity` | All fields | Category summaries with open/total counts | No `date`-based upcoming or overdue detection |
| `MashSecurityFinding` | `id`, `status`, `severity` (via filter) | Open finding count, high finding count | No aging (no `openDate`/`dueDate` used), no site attribution in summary |

**Not queried — gaps:**

| Prisma model | What NEXUS is missing |
|---|---|
| `MashDocumentControl` | Overdue inventory (`nextInventory`), accountable item exceptions, status anomalies |
| `MashMediaControl` | Overdue returns (`returnDue`), pending destruction count, flag count |
| `MashSelfInspectionOp` | Upcoming inspection dates (`dueDate`), completion progress, open findings count from `findings` JSONB |

---

### A.3 IT/Cybersecurity — `buildCyberRollup(viewer)` in `nexus/server.js`

| Attribute | Detail |
|---|---|
| Route | `GET /api/cyber-rollup`, included in `GET /api/bootstrap` as `cyber` |
| Storage | Live Prisma queries — no fallback; returns `{ _error }` on failure |
| Live or stored | Always live |
| Site-scoped | Yes — same siteFilter pattern as security rollup |
| Sufficient for leadership | **Good foundation.** Covers ATO, POAMs, users, hardware, LAVA queues, and security events. Missing control compliance, expiration horizons, and ConMon status. |

**Currently queried SCORVA/LAVA models (8 parallel queries):**

| Prisma model | Select | Rollup output | Gap |
|---|---|---|---|
| `AtoPackage` | `id, system, status, expires, siteId`, `openFindings` not selected | ATO total, expiringSoon count, by-status breakdown, system list | `openFindings` column not included. No 30/60/90-day expiration buckets — only `expiringSoon` (flat count). |
| `Poam` | All fields | Open count, by-severity breakdown, items list | `identifiedDate` read but not used for aging buckets. `riskWorkflowState` not surfaced. |
| `User` | All fields | Active/disabled counts, overdue/due-soon training | Good coverage. |
| `Workstation` | All fields | Hardware readiness % | Good. |
| `LavaSaar` | `id, status, siteId` | Pending SAAR count | No aging (no `createdAt` selected), no `accessExpiresAt` or `revalidationDueAt`. |
| `LavaSystemRequest` | All fields | Pending system requests | Good. |
| `LavaAsset` | All fields | Provisioned asset count | Good. |
| `SecurityEvent` | All fields, last 100 by `createdAt` | Open/total/critical-high counts, severity breakdown, recent list | Good. |

**Not queried — gaps:**

| Prisma model | What NEXUS is missing |
|---|---|
| `Control` | Control compliance rate (Implemented/Partial/Not Implemented counts per site) |
| `ConMon` | Overdue continuous monitoring tasks, due-this-month count |
| `Agreement` | Expiring MOUs/SLAs (30/60/90-day horizon from `expires`) |
| `License` | Expiring software licenses (`expires`) |
| `YubiKey` | Unassigned, lost, or expired tokens |
| `Tracker` | Overdue tracker items (`nextDue < today`) |

---

### A.4 Storage — Ownership Problem

NEXUS writes `program_management`, `program_security` (fallback), and `nexus_settings` into `MashCollection` (the `mash_collections` Prisma table). This is semantically wrong — NEXUS data should not live in MASH's blob store.

The `DataFabricDocument` model already exists in the schema (`data_fabric_documents` table) and is a general-purpose named-JSON-document store. NEXUS should use this table instead. The migration is a rename in `nexus/pg-store.js` from `mashCollection` to `dataFabricDocument`.

---

### A.5 Bootstrap Route

`GET /api/bootstrap` returns `{ settings, programManagement, programSecurity, cyber, _sources }` in a single call.  
- `_sources.programManagement` is always `'stored'`  
- `_sources.programSecurity` is `'live'`, `'stored'`, or `'unavailable'`  
- `_sources.cyber` is `'live'` or `'error'`  

Missing from the bootstrap: `priorityQueue`, `trendDirection`, `expirationTimeline`. These require new rollup functions and a new API surface.

---

## B. Required Data Model

### B.1 `programHealth`

| Attribute | Detail |
|---|---|
| Owner | NEXUS (from `program_management` pg-store + derived from construction/milestone status) |
| Sources | `program_management` JSON collection; eventually `Contract`/`Transaction` tables in schema |
| Key fields | `portfolio`, `construction[]`, `accreditations[]`, `realEstate[]`, `milestones[]`, `risks[]` (new), `executiveActions[]` (new), `healthScore: number` |
| Raw or derived | Both — portfolio data is raw/entered; `healthScore` is derived |
| Refresh pattern | On admin save (push-through); health score recomputed on every read |

**Health score formula (derived at read time):**
```
healthScore = weighted_average(
  construction_on_schedule_pct × 0.35,
  accreditations_on_schedule_pct × 0.25,
  milestones_on_schedule_pct × 0.20,
  budget_health_pct × 0.20
)
```
Where `on_schedule_pct` counts items with status not in `['Delayed', 'Behind', 'Critical', 'Slipped', 'Expired']` divided by total.

---

### B.2 `securityPosture`

| Attribute | Detail |
|---|---|
| Owner | MASH (read-only for NEXUS) |
| Sources | `MashFacilitySecurity`, `MashPersonnelSecurity`, `MashActivitiesSecurity`, `MashSecurityFinding`, `MashDocumentControl`, `MashMediaControl`, `MashSelfInspectionOp` |
| Key fields | See Section C for full field list |
| Raw or derived | Derived (live rollup) |
| Refresh pattern | Live on every request; fallback to `program_security` pg-store on error |

Extended shape beyond current:
```js
{
  facilitySecurity: {
    summary: { nominal, guarded, elevated },
    sites: [{ id, site, siteId, status, issue, complianceScore, lastReview, idsAlarm, fclExpires }],
    openFindingsCount, highFindingsCount,
    overdueFindings,                  // NEW — count where dueDate < today
  },
  personnelSecurity: {
    training: { current, overdue, dueSoon },
    visitAccessRequests: { open, priority, processedThisWeek },
    clearanceStatus: { active, pendingAdjudication, reinvestigationsDue },
    clearanceExpiring30d,             // NEW — count where clearancePRD <= today+30
    foreignTravelDebriefPending,      // NEW — count with unmatched debrief
  },
  activitiesSecurity: {
    headline, categories,
    openCount, overdueCount,          // NEW — date < today + status != Completed
    upcoming30d,                      // NEW — count where date in [today, today+30]
  },
  documentControl: {                  // NEW domain
    accountableTotal,                 // accountable == true count
    inventoryOverdue,                 // nextInventory < today count
    statusExceptions,                 // status != 'Active' count
  },
  mediaControl: {                     // NEW domain
    total,
    overdueReturns,                   // status == 'Overdue Return' count
    pendingDestruction,               // status == 'Pending Destruction' count
    flagged,                          // flags.length > 0 count
  },
  selfInspections: {                  // NEW domain
    upcoming90d,                      // dueDate in [today, today+90], status != Completed
    overdue,                          // dueDate < today, status != Completed
    inProgress,                       // status == 'In Progress' count
    recentCompleted,                  // completed in last 90d
  },
  _source: 'live' | 'stored' | 'unavailable',
  generatedAt,
}
```

---

### B.3 `cyberPosture`

| Attribute | Detail |
|---|---|
| Owner | SCORVA + LAVA (read-only for NEXUS) |
| Sources | All current + `Control`, `ConMon`, `Agreement`, `License`, `Tracker`, `YubiKey` |
| Key fields | See Section D for full field list |
| Raw or derived | Derived (live rollup) |
| Refresh pattern | Live on every request |

Extended shape beyond current:
```js
{
  ato: { total, expiringSoon, byStatus, expiration: { d30, d60, d90, expired }, systems[] },
  poams: { open, bySeverity, byAging: { under30, over30, over60, over90 }, riskPending, items[] },
  controlCompliance: { total, implemented, partial, notImplemented, pct },  // NEW
  conmon: { total, overdue, dueSoon },                                        // NEW
  agreements: { expiring30d, expiring60d, expiring90d },                     // NEW
  licenses: { expiring90d, overCapacity },                                    // NEW
  users: { active, disabled, pendingRequests, overdueTraining, dueSoonTraining },
  delivery: { hardwareInstalled, totalHardware, hardwareProgress, ... },
  saars: { pending, pendingOver7d, revalidationDue30d, accessExpiring30d },  // EXTENDED
  yubiKeys: { unassigned, expired },                                          // NEW
  securityEvents: { ... },
  generatedAt,
}
```

---

### B.4 `priorityQueue`

| Attribute | Detail |
|---|---|
| Owner | NEXUS (derived — cross-source aggregation) |
| Sources | `securityPosture` + `cyberPosture` + `programHealth` + NEXUS-owned `executiveActions` |
| Key fields | `items[]` each with `{ id, source, severity, category, title, site, dueDate, age, actionRequired }` |
| Raw or derived | Fully derived |
| Refresh pattern | Computed on every `/api/bootstrap` or dedicated `/api/priority-queue` call |

Priority item sources:
- `severity: 'critical'`: Elevated facilities, expired ATOs, overdue POAMs (High/Critical), open security events (Critical/High), clearances expiring in < 30 days
- `severity: 'high'`: Guarded facilities with open issues, POAMs past due date, ConMon overdue, SAAR backlog > 14 days, overdue self-inspections
- `severity: 'watch'`: POAMs due in 30 days, ATOs expiring in 60 days, clearances expiring in 90 days, personnel with overdue training

---

### B.5 `trendSnapshot`

| Attribute | Detail |
|---|---|
| Owner | NEXUS (new) |
| Sources | Point-in-time snapshots of key metrics from `securityPosture` and `cyberPosture` |
| Key fields | `snapshotAt`, `cyberScore`, `securityScore`, `openPoams`, `openFindings`, `nominalFacilities`, `authorizedAtos` |
| Raw or derived | Derived + stored |
| Refresh pattern | Periodic (daily cron or on-demand) — write to new `NexusSnapshot` Prisma model |

Purpose: compare current value to the previous snapshot to derive `trendDirection: 'up' | 'down' | 'flat'` for display on KPI cards.

---

### B.6 `executiveActions`

| Attribute | Detail |
|---|---|
| Owner | NEXUS (new, writable) |
| Sources | NEXUS-owned `executiveActions` collection |
| Key fields | `[{ id, title, owner, dueDate, status, priority, source, linkedTo }]` |
| Raw or derived | Raw (manually entered) |
| Refresh pattern | Immediate on admin save |

This is the leadership action tracker — items that require a named person to act by a date. Editable only by NEXUS admins. Read by all authenticated users. Feeds into `priorityQueue` for overdue/due-soon items.

---

## C. MASH Inputs Needed

### C.1 `MashFacilitySecurity` — `mash_facility_security`

**Minimum fields for NEXUS:**

| Field | Type | Aggregation |
|---|---|---|
| `siteId` | String | Group by site |
| `name` | String | Display |
| `status` | String | Classify: Nominal / Guarded / Elevated |
| `complianceScore` | Int? | Average per site |
| `openIssues` | Json (array) | `openIssues.length` per facility |
| `alarmIDS` | Json | `alarmIDS.status !== 'Operational'` → IDS issue flag |
| `dcsaInspection` | Json | `dcsaInspection.lastDate`, `dcsaInspection.nextDate` |
| `fclExpires` | String? | Days until FCL expiration |
| `fclStatus` | String? | Suspended / Revoked / Active status |

**Current availability:** All present in `MashFacilitySecurity`. `openIssues`, `alarmIDS`, `dcsaInspection` are JSONB — read as parsed JS objects by Prisma. No Prisma select needed; current `findMany` reads all fields.

**Aggregation to add to `buildSecurityRollup`:**
- Count facilities where `alarmIDS.status !== 'Operational' && alarmIDS.status != null`
- Add `fclExpiring30d` count where `fclExpires` is within 30 days of today
- Include `complianceScore` avg in site list response

---

### C.2 `MashPersonnelSecurity` — `mash_personnel_security`

**Minimum fields:**

| Field | Type | Aggregation |
|---|---|---|
| `siteId` | String | Group by site |
| `clearancePRD` | String? | `prd <= today+30` → `clearanceExpiring30d` |
| `clearancePRD` | String? | `prd <= today+90` → `clearanceExpiring90d` |
| `clearanceStatus` | String? | Count by status |
| `clearanceLevel` | String? | Count by level |
| `training` | Json | Check 4 field variants: `trainingDue`, `annualReviewDue`, `dueDate`, `annualBriefingDue` |
| `visitAccessRequests` | Json (array) | Count open / priority / processed-this-week |
| `foreignTravel` | Json (array) | Count where `!entry.debriefed` → debrief pending |

**Aggregation to add:**
```js
const clearanceExpiring30d = personnel.filter(p =>
  p.clearancePRD && new Date(p.clearancePRD) <= in30d && new Date(p.clearancePRD) >= today
).length;

const debriefPending = personnel.filter(p =>
  (parseJsonField(p.foreignTravel) || []).some(t => !t.debriefed)
).length;
```

**Current availability:** All fields present. Training JSONB detection is already implemented (4-variant check). `clearancePRD` is already used for PRD comparison but not aggregated into the rollup response. `foreignTravel` is read but only checked inline in MASH's overview route, not exposed to NEXUS.

---

### C.3 `MashActivitiesSecurity` — `mash_activities_security`

**Minimum fields:**

| Field | Type | Aggregation |
|---|---|---|
| `siteId` | String | Group by site |
| `category` | String? | Bucket counts |
| `status` | String | Open/Completed/Overdue counts |
| `date` | String? | Upcoming30d, overdue detection |
| `title` | String | Display in upcoming list |

**Aggregation to add:**
```js
const todayStr = today.toISOString().split('T')[0];
const in30Str  = in30d.toISOString().split('T')[0];

const overdueActivities = activities.filter(a =>
  a.date && a.date < todayStr && !['Completed', 'Cancelled'].includes(a.status)
).length;

const upcoming30d = activities.filter(a =>
  a.date && a.date >= todayStr && a.date <= in30Str
).slice(0, 5);
```

**Current availability:** All fields present. Currently used only for category/open-item count. Date-based detection is not implemented but the data is already fetched.

---

### C.4 `MashSecurityFinding` — `mash_security_findings`

**Minimum fields:**

| Field | Type | Aggregation |
|---|---|---|
| `siteId` | String | Group by site |
| `severity` | String | Count by Critical/High/Medium/Low |
| `status` | String | Open/Closed |
| `dueDate` | String? | Overdue detection |
| `openDate` | String? | Aging (days open) |
| `area` | String? | Category breakdown |

**Aggregation to add:**
```js
const overdueFindings = openFindings.filter(f =>
  f.dueDate && f.dueDate < todayStr
).length;

const avgAgeOpen = openFindings.length
  ? Math.round(openFindings.reduce((sum, f) => {
      if (!f.openDate) return sum;
      return sum + Math.floor((now - new Date(f.openDate)) / DAY_MS);
    }, 0) / openFindings.length)
  : null;
```

**Current availability:** `dueDate` and `openDate` (as `open_date`) are in the schema but not currently used in the NEXUS rollup. Currently only `status` and `severity` are used.

---

### C.5 `MashDocumentControl` — `mash_document_control` (NOT currently read)

**Minimum fields:**

| Field | Type | Aggregation |
|---|---|---|
| `siteId` | String | Group by site |
| `accountable` | Boolean | Count where `accountable == true` |
| `nextInventory` | String? | Count where `nextInventory < today` |
| `status` | String | Count non-Active |

**Proposed aggregation:**
```js
const [documents] = await Promise.all([
  db.mashDocumentControl.findMany({ where: siteFilter, select: {
    siteId: true, accountable: true, nextInventory: true, status: true,
  }}),
]);

const accountableTotal = documents.filter(d => d.accountable).length;
const inventoryOverdue = documents.filter(d =>
  d.nextInventory && d.nextInventory < todayStr
).length;
const statusExceptions = documents.filter(d => d.status !== 'Active').length;
```

**Current availability:** Model exists and is populated by MASH Phase C. Not queried by NEXUS at all. Add to `buildSecurityRollup` as the 5th parallel query.

---

### C.6 `MashMediaControl` — `mash_media_control` (NOT currently read)

**Minimum fields:**

| Field | Type | Aggregation |
|---|---|---|
| `siteId` | String | Group by site |
| `status` | String | `Overdue Return`, `Pending Destruction` counts |
| `returnDue` | String? | Past-due returns |
| `flags` | Json (array) | `flags.length > 0` → flagged count |

**Proposed aggregation:**
```js
const media = await db.mashMediaControl.findMany({ where: siteFilter, select: {
  siteId: true, status: true, returnDue: true, flags: true,
}});

const overdueReturns = media.filter(m =>
  m.status === 'Overdue Return' || (m.returnDue && m.returnDue < todayStr)
).length;
const pendingDestruction = media.filter(m => m.status === 'Pending Destruction').length;
const flagged = media.filter(m => (parseJsonField(m.flags) || []).length > 0).length;
```

**Current availability:** Model exists. Not queried by NEXUS. Add to `buildSecurityRollup` as the 6th parallel query.

---

### C.7 `MashSelfInspectionOp` — `mash_self_inspection_ops` (NOT currently read)

**Minimum fields:**

| Field | Type | Aggregation |
|---|---|---|
| `siteId` | String | Group by site |
| `status` | String | In Progress / Planned / Complete counts |
| `dueDate` | String? | Upcoming 90d, overdue detection |
| `progress` | Int? | Average for in-progress |
| `title` | String | Display in upcoming list |
| `completedDate` | String? | Recent completions |

**Proposed aggregation:**
```js
const in90Str = new Date(now.getTime() + 90 * DAY_MS).toISOString().split('T')[0];

const inspections = await db.mashSelfInspectionOp.findMany({ where: siteFilter, select: {
  siteId: true, status: true, dueDate: true, progress: true, title: true, completedDate: true,
}});

const upcoming90d = inspections.filter(i =>
  i.dueDate && i.dueDate >= todayStr && i.dueDate <= in90Str && i.status !== 'Completed'
);
const overdueInspections = inspections.filter(i =>
  i.dueDate && i.dueDate < todayStr && i.status !== 'Completed'
).length;
```

**Current availability:** Model exists. Not queried by NEXUS. Add to `buildSecurityRollup` as the 7th parallel query.

---

## D. SCORVA Inputs Needed

### D.1 `AtoPackage` — `ato_packages` (extended)

**Currently selected:** `id, system, status, expires, siteId` (plus metadata)

**Add to select:**
| Field | Use |
|---|---|
| `openFindings` (Int) | Include in per-ATO display and aggregate |
| `issued` (String?) | For ATO age calculation |

**Add expiration bucketing:**
```js
const expirationBuckets = atos.reduce((acc, a) => {
  if (!a.expires) { acc.unknown++; return acc; }
  const daysLeft = Math.ceil((new Date(a.expires + 'T12:00:00Z') - now) / DAY_MS);
  if (daysLeft < 0)        acc.expired++;
  else if (daysLeft <= 30) acc.d30++;
  else if (daysLeft <= 60) acc.d60++;
  else if (daysLeft <= 90) acc.d90++;
  else                     acc.beyond90++;
  return acc;
}, { expired: 0, d30: 0, d60: 0, d90: 0, beyond90: 0, unknown: 0 });
```

**Current availability:** All fields in schema. `openFindings` and `issued` not currently selected.

---

### D.2 `Poam` — `poams` (extended)

**Currently selected:** All fields

**Add POAM aging buckets:**
```js
const poamAging = openPoams.reduce((acc, p) => {
  const startDate = p.identifiedDate || p.scheduledCompletion;
  if (!startDate) { acc.unknown++; return acc; }
  const age = Math.floor((now - new Date(startDate + 'T12:00:00Z')) / DAY_MS);
  if (age <= 30)       acc.under30++;
  else if (age <= 60)  acc.over30++;
  else if (age <= 90)  acc.over60++;
  else                 acc.over90++;
  return acc;
}, { under30: 0, over30: 0, over60: 0, over90: 0, unknown: 0 });

const riskPending = openPoams.filter(p =>
  p.riskWorkflowState && !['Approved', 'Rejected'].includes(p.riskWorkflowState)
).length;
```

**Current availability:** `identifiedDate` and `riskWorkflowState` are in the schema and already fetched. Not yet used in NEXUS rollup output.

---

### D.3 `Control` — `controls` (NEW to NEXUS)

**Minimum fields:**

| Field | Use |
|---|---|
| `siteId` | Tenant filter |
| `status` | Group: Implemented / Partially Implemented / Not Implemented |
| `family` | Optional: breakdown by control family (AC, AU, CM, etc.) |

**Proposed query:**
```js
const controls = await db.control.findMany({
  where: siteFilter,
  select: { siteId: true, status: true, family: true },
});

const implemented = controls.filter(c => c.status === 'Implemented').length;
const partial     = controls.filter(c => c.status === 'Partially Implemented').length;
const notImpl     = controls.filter(c => c.status === 'Not Implemented').length;
const compliancePct = controls.length
  ? Math.round(((implemented + partial * 0.5) / controls.length) * 100)
  : null;
```

**Current availability:** `Control` model has all needed fields and siteId index. Not queried by NEXUS at all.

---

### D.4 `ConMon` — `con_mon` (NEW to NEXUS)

**Minimum fields:**

| Field | Use |
|---|---|
| `siteId` | Tenant filter |
| `status` | Open / Completed / Pending |
| `dueDate` | Overdue detection |

**Proposed query:**
```js
const conmons = await db.conMon.findMany({
  where: siteFilter,
  select: { siteId: true, status: true, dueDate: true },
});

const overdueConmon = conmons.filter(c =>
  c.dueDate && c.dueDate < todayStr && c.status !== 'Completed'
).length;
const dueSoonConmon = conmons.filter(c =>
  c.dueDate && c.dueDate >= todayStr && c.dueDate <= in30Str && c.status !== 'Completed'
).length;
```

**Current availability:** `ConMon` model exists with full schema. Not queried by NEXUS.

---

### D.5 `Agreement` — `agreements` (NEW to NEXUS)

**Minimum fields:** `siteId`, `status`, `expires`, `category`

**Proposed aggregation:**
```js
const agreements = await db.agreement.findMany({
  where: { ...siteFilter, status: 'Active' },
  select: { siteId: true, expires: true, category: true },
});

const agreementExpiring = { d30: 0, d60: 0, d90: 0 };
agreements.forEach(a => {
  if (!a.expires) return;
  const d = Math.ceil((new Date(a.expires + 'T12:00:00Z') - now) / DAY_MS);
  if (d >= 0 && d <= 30)  agreementExpiring.d30++;
  if (d >= 0 && d <= 60)  agreementExpiring.d60++;
  if (d >= 0 && d <= 90)  agreementExpiring.d90++;
});
```

**Current availability:** `Agreement` model exists with all needed fields. Not queried by NEXUS.

---

### D.6 `License` — `licenses` (NEW to NEXUS)

**Minimum fields:** `siteId`, `status`, `expires`, `seats`, `used`

**Proposed aggregation:**
```js
const licenses = await db.license.findMany({
  where: { ...siteFilter, status: 'Active' },
  select: { siteId: true, expires: true, seats: true, used: true },
});

const expiring90d = licenses.filter(l => {
  if (!l.expires) return false;
  const d = Math.ceil((new Date(l.expires + 'T12:00:00Z') - now) / DAY_MS);
  return d >= 0 && d <= 90;
}).length;

const overCapacity = licenses.filter(l => l.seats > 0 && l.used > l.seats).length;
```

**Current availability:** `License` model exists. Not queried by NEXUS.

---

### D.7 `LavaSaar` — `lava_saars` (extended)

**Currently selected:** `id, status, siteId` only

**Add to select:**
| Field | Use |
|---|---|
| `createdAt` | SAAR aging (`pendingOver7d`, `pendingOver14d`) |
| `accessExpiresAt` | Access expiring soon |
| `revalidationDueAt` | Revalidation due |

```js
const pendingOver7d = saars.filter(s =>
  s.status === 'pending' &&
  s.createdAt && Math.floor((now - s.createdAt) / DAY_MS) >= 7
).length;

const accessExpiring30d = saars.filter(s =>
  s.accessExpiresAt && s.accessExpiresAt <= in30d && s.accessExpiresAt >= now
).length;
```

**Current availability:** All fields exist in schema. `createdAt`, `accessExpiresAt`, `revalidationDueAt` not currently included in the NEXUS select.

---

### D.8 `YubiKey` — `yubi_keys` (NEW to NEXUS)

**Minimum fields:** `siteId`, `status`, `lostDestroyedDate`

```js
const yubiKeys = await db.yubiKey.findMany({
  where: siteFilter,
  select: { siteId: true, status: true, lostDestroyedDate: true },
});
const unassigned = yubiKeys.filter(k => k.status === 'Unassigned').length;
const lostDestroyed = yubiKeys.filter(k => k.lostDestroyedDate).length;
```

**Current availability:** `YubiKey` model exists. Not queried by NEXUS.

---

## E. NEXUS-Owned PM Inputs

### E.1 Current state — what exists

All NEXUS-owned data is stored as a JSON blob in `MashCollection` under the name `program_management`. The shape is:

```
portfolio: { name, fiscalYear, budgetTotal, budgetObligated, budgetRemaining, kpis[] }
realEstate: [{ id, site, type, status, dueDate, owner }]
construction: [{ id, name, type, status, progress, budget, schedule, accreditation }]
accreditations: [{ id, name, level, status, targetDate }]
milestones: [{ id, title, date, status }]
```

This is first-class stored data. The admin console (`AdminPage.jsx` + `/api/admin/pm/*` routes) provides full CRUD. **This should remain a JSON blob in pg-store — it is the right model for user-edited structured documents.**

The only change needed is to move storage from `MashCollection` to `DataFabricDocument` (rename in `nexus/pg-store.js`).

---

### E.2 What should be added to the PM collection

The following sections should be added to `program_management` as new top-level arrays, with corresponding Admin console tabs and API routes:

#### Risks (`risks[]`)

```json
{
  "id": "risk-001",
  "title": "Alexandria SCIF schedule slip",
  "description": "3-week delay in duct work may push DCSA inspection past Q3 target",
  "category": "Schedule",
  "likelihood": "Medium",
  "impact": "High",
  "status": "Open",
  "owner": "Facilities PMO",
  "mitigation": "Procure alternative HVAC contractor",
  "dueDate": "2026-06-20",
  "linkedTo": "pm-01"
}
```

Fields: `id`, `title`, `description`, `category` (Schedule / Budget / Technical / Security / Staffing / External), `likelihood` (Low / Medium / High), `impact` (Low / Medium / High), `status` (Open / Mitigated / Accepted / Closed), `owner`, `mitigation`, `dueDate`, `linkedTo` (optional reference to construction/milestone/accreditation id).

#### Executive Actions (`executiveActions[]`)

```json
{
  "id": "action-001",
  "title": "Approve Alexandria inspection waiver request",
  "owner": "Program Director",
  "dueDate": "2026-06-10",
  "status": "Open",
  "priority": "High",
  "source": "NEXUS",
  "notes": "Requires PM signature before DCSA submission"
}
```

Fields: `id`, `title`, `owner`, `dueDate`, `status` (Open / In Progress / Complete / Deferred), `priority` (Low / Medium / High / Critical), `source` (NEXUS / MASH / SCORVA / LAVA), `notes`.

#### Contracts (`contracts[]`) — optional link to schema `Contract` model

For now, store manually. In a future phase, derive from `Contract` + `Transaction` tables (already in schema) which carry `totalValue`, `amountSpent`, `expiration`, `status`, and link to a `MashSite`.

```json
{
  "id": "contract-001",
  "name": "Alexandria Facilities Management",
  "vendor": "CBRE Government",
  "value": 2400000,
  "obligated": 1200000,
  "expiration": "2027-09-30",
  "status": "Active",
  "site": "MTSI-ALX"
}
```

---

### E.3 Demo vs first-class data distinction

| Data | Current state | Target state |
|---|---|---|
| `portfolio` (budget, fiscalYear, name) | Demo values in seed JSON | First-class: admin enters real FY and budget |
| `construction` projects | Demo: 3 sample projects | First-class: PM enters each project manually |
| `accreditations` | Demo: 3 sample items | First-class: PM tracks each accreditation |
| `realEstate` | Demo: 3 sample actions | First-class: PM enters each action |
| `milestones` | Demo: 4 sample milestones | First-class: PM manages the schedule |
| `kpis` | Demo: 4 sample cards with static values | Hybrid: PM can enter custom KPIs; budget-health KPI auto-computed |
| `risks` | **Missing** | First-class: PM enters and tracks risks |
| `executiveActions` | **Missing** | First-class: PM/executive logs actions |
| `contracts` | **Missing** | First-class (manual) or derived from `Contract` table |

The `kpis` array today requires manual value entry. A future improvement: offer auto-computed KPIs from SCORVA/MASH (e.g., "Active ATOs" auto-pulled from cyber rollup, "Training Compliance %" auto-pulled from security rollup) alongside custom PM KPIs.

---

## F. Derived Metrics

### F.1 Site Readiness Score

**Purpose:** Single 0–100 score per site answering "is this site operationally ready?"

**Inputs and weights:**
```
siteReadiness = weighted_average(
  nominal_facility_pct  × 0.25,   // securityPosture.facilitySecurity.summary
  training_current_pct  × 0.20,   // securityPosture.personnelSecurity.training
  authorized_ato_pct    × 0.25,   // cyberPosture.ato.byStatus.Authorized / total
  control_compliance_pct × 0.20,  // cyberPosture.controlCompliance.pct
  open_high_poams_score  × 0.10   // 100 - min(100, openHighPoams × 10)
)
```

**Implementation:** Computed inside `buildCyberRollup` per site (requires per-site pass instead of aggregate). Expose as `cyberPosture.siteScores: [{ siteId, readinessScore }]`.

**Display placement:** Cyber page — new "Site Readiness" panel below the ATO section. Also shown as a per-site row in a future Site Overview page.

---

### F.2 Cyber Readiness Score

**Purpose:** Enterprise-level 0–100 cyber posture score.

**Inputs:**
```
cyberReadiness = weighted_average(
  authorized_pct        × 0.30,   // authorized ATOs / total ATOs
  control_pct           × 0.25,   // implemented controls pct
  overdue_poam_factor   × 0.25,   // 100 - min(100, overduePoams × 8)
  hardware_pct          × 0.10,   // delivery.hardwareProgress
  saar_clearance        × 0.10    // 100 - min(100, pendingOver14d × 5)
)
```

**Display placement:** Cyber page header as a posture gauge (replaces the derived text label).

---

### F.3 Program Health Score

**Purpose:** Enterprise program management health.

**Inputs:**
```
programHealth = weighted_average(
  construction_on_schedule_pct  × 0.35,
  accreditations_on_schedule_pct × 0.25,
  milestones_on_schedule_pct    × 0.20,
  budget_pct_remaining          × 0.20  // budgetRemaining / budgetTotal
)
```

Where "on schedule" = status not in `['Delayed', 'Behind', 'Critical', 'Slipped', 'Expired']`.

**Display placement:** Program Management page header — alongside the FY badge.

---

### F.4 Top Risks

**Purpose:** Surface the 5–7 most urgent cross-source risk items.

**Inputs (ranked by severity then due date):**
- NEXUS `risks[]` where status = 'Open' and impact = 'High' or likelihood = 'High'
- NEXUS `executiveActions[]` where status = 'Open' and priority = 'Critical' and dueDate < today+7
- POAMs where severity = Critical/High and status = Open and scheduledCompletion < today
- ATOs where status = Expired or expires within 30 days
- Security findings where severity = High and status = Open and dueDate < today
- Elevated facilities
- Clearances expiring in < 30 days

**Display placement:** Priority Queue page (new `PriorityQueuePage.jsx`) + embedded as a strip at the top of the Program Management page.

---

### F.5 Overdue Action Queue

**Purpose:** All overdue items from all sources, sorted by days overdue.

**Inputs:**
- `executiveActions[]` where dueDate < today and status ≠ Complete
- `milestones[]` where date < today and status ≠ Complete
- Open POAMs where scheduledCompletion < today
- ConMon items where dueDate < today and status ≠ Completed
- Inspection campaigns where targetDate < today and status ≠ Complete
- SAAR requests where createdAt > 14 days ago and status = pending

**Display placement:** Priority Queue page top section. Also count badge on the nav link.

---

### F.6 30/60/90-Day Expiration Horizon

**Purpose:** Give leadership visibility on upcoming expirations before they become incidents.

**Inputs per bucket:**

| Bucket | Sources |
|---|---|
| 30-day | ATOs, Agreements, FCL, LavaSaar access, clearance PRDs, Licenses |
| 60-day | ATOs, Agreements, LavaSaar revalidation |
| 90-day | ATOs, Agreements, Licenses, upcoming inspections |

**Display placement:** Cyber page — new "Expiration Horizon" card with timeline rows, one per category.

---

### F.7 Trend Direction

**Purpose:** Show whether each key metric is improving or degrading since the last snapshot.

**Inputs:** Current value vs `nexus_snapshots` most-recent row for the same metric.

**Formula:**
```
trendDirection = current < previous ? 'improving'  // for risk metrics (lower = better)
               : current > previous ? 'degrading'
               : 'flat'
// For compliance metrics, invert: higher = better
```

**Display placement:** Small directional arrow and percentage delta on KPI cards where trend data is available.

---

## G. Recommended Storage / Query Design

### G.1 Decision Matrix

| Data surface | Recommended pattern | Rationale |
|---|---|---|
| Security rollup (`buildSecurityRollup`) | **Live query** | MASH tables are small; query is fast; data changes frequently |
| Cyber rollup (`buildCyberRollup`) | **Live query** | SCORVA tables are indexed; query is fast with siteId filter |
| Priority queue (`buildPriorityQueue`) | **Derived from live rollups** — compute after both rollups finish; no separate query | Aggregates existing rollup outputs; no DB round-trip needed |
| Program health score | **Computed in-process** from `program_management` JSON | Pure JS — no DB needed |
| Site readiness scores | **Computed in `buildCyberRollup`** as a per-site pass | Reuses existing query results; no extra DB cost |
| Expiration horizon | **Derived from live rollup outputs** | ATOs, Agreements, Licenses all fetched in cyber rollup |
| `program_management` data | **Stored JSON in `DataFabricDocument`** | User-edited; no auto-compute needed; keep current pg-store approach with table rename |
| `nexus_settings` | **Stored JSON in `DataFabricDocument`** | Rarely changes; single document |
| Trend data / snapshots | **New `NexusSnapshot` Prisma model** (proposed) | Required for historical delta; cannot be live |
| Executive actions / risks | **Stored JSON in `DataFabricDocument`** | Admin-managed; extend `program_management` shape |

### G.2 Proposed `NexusSnapshot` Prisma model

Add to `packages/db/prisma/schema.prisma`:

```prisma
model NexusSnapshot {
  id              String   @id @default(cuid())
  snapshotAt      DateTime @default(now()) @map("snapshot_at")
  siteId          String?  @map("site_id")   // null = enterprise aggregate
  cyberScore      Int?     @map("cyber_score")
  securityScore   Int?     @map("security_score")
  programScore    Int?     @map("program_score")
  openPoams       Int?     @map("open_poams")
  authorizedAtos  Int?     @map("authorized_atos")
  expiredAtos     Int?     @map("expired_atos")
  openFindings    Int?     @map("open_findings")
  nominalFacilities Int?   @map("nominal_facilities")
  overdueTraining Int?     @map("overdue_training")
  pendingSaars    Int?     @map("pending_saars")
  meta            Json?    @default("{}") // extensible bucket for extra fields

  @@index([snapshotAt])
  @@index([siteId, snapshotAt])
  @@map("nexus_snapshots")
}
```

**Migration file:** `packages/db/prisma/migrations/20260606000000_nexus_snapshot/migration.sql`

**Snapshot trigger:** Call `snapshotCurrentRollup(db, viewer)` from NEXUS server on a schedule (daily via a startup `setInterval`) or on admin request via `POST /api/admin/snapshot`. Compare `snapshotAt` of latest row to now; skip if < 20 hours old.

### G.3 pg-store Migration — `MashCollection` → `DataFabricDocument`

In `nexus/pg-store.js`, replace:
```js
const row = await client.mashCollection.findUnique({ where: { name } });
// ...
await client.mashCollection.upsert({ where: { name }, create: { name, data }, update: { data } });
```
With:
```js
const row = await client.dataFabricDocument.findUnique({ where: { name } });
// ...
await client.dataFabricDocument.upsert({ where: { name }, create: { name, data }, update: { data } });
```

This is a 2-line change in `nexus/pg-store.js`. No data migration needed — the documents can be re-seeded from the JSON seed files if needed, or a one-time copy script can move the rows.

---

## H. Execution Roadmap

### Phase 1 — Stabilize Source Contracts
**Goal:** Fix what NEXUS reads from MASH and SCORVA so rollup outputs are complete and correct.

**Files to change:**
- `nexus/server.js` — `buildSecurityRollup`: add MashDocumentControl, MashMediaControl, MashSelfInspectionOp queries; add aging/expiration logic to personnel and findings; add IDS/FCL fields to facility output
- `nexus/server.js` — `buildCyberRollup`: add Control compliance, ConMon, Agreement, License, YubiKey queries; add POAM aging buckets; add ATO expiration bucketing; extend LavaSaar select

**Blocking dependencies:** MASH Phase C tables must be populated (backfill complete). SCORVA `siteId` indexes must be in place (Phase B complete — confirmed by site-tenantization.md).

**Verification:**
```
GET /api/bootstrap → cy.programSecurity.documentControl must exist
GET /api/bootstrap → cy.cyber.controlCompliance.pct must be a number
GET /api/bootstrap → cy.cyber.ato.expiration.d30 must exist
GET /api/security-rollup → result.selfInspections must exist
```

---

### Phase 2 — Add Rollup Builders
**Goal:** Add priority queue, site readiness, and expiration timeline to the server.

**Files to change:**
- `nexus/server.js` — add `buildPriorityQueue(cyberRollup, securityRollup, pmData)` function
- `nexus/server.js` — add `buildSiteReadinessScores(cyberRollup)` function
- `nexus/server.js` — extend `buildCyberRollup` return value with `siteScores`
- `nexus/server.js` — add `GET /api/priority-queue` route
- `nexus/server.js` — extend `GET /api/bootstrap` to include `priorityQueue`
- `nexus/server.js` — add `POST /api/admin/snapshot` route (manual snapshot trigger)
- `nexus/pg-store.js` — change `mashCollection` → `dataFabricDocument` (2-line change)

**Blocking dependencies:** Phase 1 complete. `DataFabricDocument` table in schema (already present — no migration needed).

**Verification:**
```
GET /api/priority-queue → array of items, each with { id, source, severity, title, dueDate }
GET /api/bootstrap → result.priorityQueue must exist
POST /api/admin/snapshot → creates row in nexus_snapshots
```

---

### Phase 3 — Add History / Trend Storage
**Goal:** Enable trend arrows on KPI cards.

**Files to change:**
- `packages/db/prisma/schema.prisma` — add `NexusSnapshot` model
- `packages/db/prisma/migrations/` — new migration file
- `nexus/server.js` — add `snapshotCurrentRollup(db, rollup)` function
- `nexus/server.js` — call `snapshotCurrentRollup` on daily interval on server start
- `nexus/server.js` — add `GET /api/trend` route returning latest 2 snapshots for delta calculation

**Blocking dependencies:** Phase 2 complete. Migration must run before the server can write snapshots.

**Verification:**
```
After 2 manual snapshot triggers:
GET /api/trend → { current: {}, previous: {}, delta: { openPoams: -2, authorizedAtos: +1 } }
```

---

### Phase 4 — Expose API Routes
**Goal:** Wire all new data surfaces through the NEXUS API.

**Files to change:**
- `nexus/server.js` — verify and document all routes added in Phase 2–3
- `nexus/server.js` — add `GET /api/site-readiness` route (list of site scores)
- `nexus/server.js` — add `GET /api/expiration-timeline` route (30/60/90 buckets)
- `nexus/server.js` — add `POST /api/admin/pm/risks` and `PUT/DELETE` for risks array
- `nexus/server.js` — add `POST /api/admin/pm/executiveActions` and `PUT/DELETE`
- `nexus/server.js` — add `POST /api/admin/pm/contracts` and `PUT/DELETE`

**Blocking dependencies:** Phase 3 complete.

**Verification:**
- All new routes return 401 without token
- Admin routes return 403 for non-admin tokens
- `GET /api/expiration-timeline` returns correct bucket counts matching ATO data

---

### Phase 5 — Wire Dashboard Pages
**Goal:** Make NEXUS feel like a decision surface, not a data viewer.

**Files to change:**
- `nexus/client/src/pages/ProgramCyberPage.jsx` — add expiration horizon timeline, site readiness panel, cyber score gauge
- `nexus/client/src/pages/ProgramManagementPage.jsx` — add risks section, executive actions section, program health score in header
- `nexus/client/src/pages/ProgramSecurityPage.jsx` — add document/media/inspection summary panels, clearance expiration alert
- `nexus/client/src/components/MetricCard.jsx` — add optional `trend` prop (up/down/flat arrow + delta display)
- `nexus/client/src/App.jsx` — add `priorityQueue` to bootstrap data extraction; pass to pages
- New file: `nexus/client/src/pages/PriorityQueuePage.jsx` — cross-source action queue
- `nexus/client/src/components/AppHeader.jsx` — add overdue count badge on Priority Queue nav link

**Blocking dependencies:** Phase 4 complete (all API routes must exist).

**Verification:**
- Program Management page shows risks and executive actions sections when data exists
- Cyber page shows expiration horizon with correct day buckets
- Priority queue page renders items from all three sources
- Trend arrows appear on KPI cards when snapshot data is available

---

### Phase 6 — Operator / Leadership Queues
**Goal:** Make NEXUS writable enough for leadership to act, not just read.

**Files to change:**
- `nexus/client/src/pages/AdminPage.jsx` — add tabs for Risks, Executive Actions, Contracts
- `nexus/client/src/pages/PriorityQueuePage.jsx` — add inline status-update for executive actions
- `nexus/server.js` — add `PUT /api/admin/settings` extensions (e.g., priority queue configuration)

**Blocking dependencies:** Phase 5 complete.

**Verification:**
- Admin can add a risk via the Admin console and it appears immediately in the Priority Queue page
- Executive actions can be marked Complete from the Priority Queue page
- Status changes persist across page refresh

---

## Summary — Required vs Nice-to-Have

### Required now (Phases 1–2)

| Item | Why |
|---|---|
| Extend `buildSecurityRollup` with doc/media/inspection domains | Three MASH domains are completely blind to NEXUS today |
| Extend `buildCyberRollup` with control compliance, ConMon, expiration buckets | Critical for leadership cyber posture question |
| Add `buildPriorityQueue` | The "what is off track" question has no answer today |
| Add risks and executive actions to PM collection | No current mechanism for leadership to log decisions |
| Move pg-store from `MashCollection` to `DataFabricDocument` | Semantic correctness; low risk 2-line change |

### Future nice-to-have (Phases 3–6)

| Item | When |
|---|---|
| `NexusSnapshot` + trend arrows | After Phases 1–2 data is stable; needs at least 2 data points |
| Per-site readiness score | After control compliance query is added |
| Priority Queue page | After priority queue builder is complete |
| Executive action inline update | After Priority Queue page exists |
| Auto-computed KPIs from SCORVA/MASH | After Phase 1 rollup outputs are stable |
| Contract/spend linkage from schema `Contract` table | Low urgency — manual entry suffices for now |
