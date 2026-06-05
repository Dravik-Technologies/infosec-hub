# Cross-App Audit — HUB Control Plane Compatibility
**Date:** 2026-06-04  
**Lane:** Claude — cross-app audit and compatibility  
**Reference:** [hub-control-plane-architecture.md](./hub-control-plane-architecture.md)

---

## Compatibility Matrix

| App | Entry gate | Site scope | Job role dependency | Action needed |
|---|---|---|---|---|
| **SCORVA** | `hasAppAccess(user, 'scorva')` on both local login and SSO — ✅ explicit | `tenantHandler` + `missionSiteScope` middleware on every data route — ✅ strong | `getScorvaRole` derives legacy role from `securityRole` for backward compat only; no auth use | Low — document legacy alias, remove when SCORVA's own role model matures |
| **MASH** | ❌ None before this fix — login URL was also wrong (`/api/auth/login` vs `/auth/login`) | `tenantScope.js` with `resolveTenantScope` + `resolveWriteSiteId` on all site-owned collections — ✅ strong | `securityRole` → `wsRole` mapping drives workspace behavior (which nav sections are visible, which collections are writable) | **Fixed:** login URL + allowedApps gate added. `wsRole` mapping is intentional app-local behavior; keep |
| **LAVA** | `hasAppAccess(user, 'lava')` on both local login and SSO — ✅ explicit | `isSiteAllowed` per-record on all CRUD; `buildSiteFilter` on list endpoints. ❌ Hardware list (`GET /api/hardware`) had no site filter when called without `systemId` | `isVulcanUser` derives operator access from `securityRole` (`Information Technology`, `Information Security`) | **Fixed:** hardware list site scope added. `isVulcanUser` is app-local operator check; classify as keep-for-now per architecture §9 |
| **NEXUS** | ❌ None before this fix — login and SSO both let any HUB user in | Site filter used in `buildCyberRollup` and `buildSecurityRollup` via `siteIds` — ✅ reads enforced; no write paths (read-only rollup + admin JSON store) | `requireAdminRole` grants write access to `role === 'Program Manager'` or `securityRole === 'Program Manager'`; no direct DB writes on sensitive tables | **Fixed:** allowedApps gate on login and SSO. `requireAdminRole` PM path should move to explicit app-local rule |
| **CRATER** | ❌ Not present — no server code in this repo | N/A — not implemented | N/A | Must be audited when its server is added; HUB already lists it in the app launcher |

---

## App-by-App Detail

### SCORVA (`scorva-v1/`)

**Entry gate:**  
Both local login ([auth.js:68](../scorva-v1/server/routes/auth.js#L68)) and SSO ([auth.js:106](../scorva-v1/server/routes/auth.js#L106)) call `hasAppAccess(found, 'scorva')` against the local DB user after verifying credentials. Strong.

**Claims consumed from HUB token/session:**  
`role`, `siteId`, `siteIds` (both case variants normalized), `canSeeAllSites`, `securityRole`.  
`requireAuth` ([middleware/requireAuth.js](../scorva-v1/server/middleware/requireAuth.js)) normalizes all variants and derives `canSeeAllSites` from both the JWT claim and `role === 'Corporate Admin'`.

**Site scope — reads:**  
`tenantHandler` attaches `req.applyTenantFilter` and `req.assertTenantDocument` to every request under `/api/*` except `/api/sites`, `/api/threats`, and `/api/checklist`. `missionSiteScope` further narrows to a single active site for mission-app routes. Reads are correctly filtered.

**Site scope — writes:**  
`missionSiteScope` stamps `req.body.siteId` with the resolved active site on every mutating request. Per-record `assertTenantDocument` guards individual record updates and deletes. Strong.

**Remaining gap:**  
`/api/checklist` is mounted with `requireAuth` only — `tenantHandler` is applied to `checklistCampaignRouter` but not to the base `checklistRouter`. If checklist items carry a siteId, those reads are unfiltered.  
`/api/aggregate` and `/api/threats` have `requireAuth` only, no tenant middleware — verify these return site-scoped data or are intentionally cross-site.

**JWT payload:**  
`signAccessToken` ([middleware/jwt.js](../scorva-v1/server/middleware/jwt.js)) does not include `canSeeAllSites` or `securityRole` in the payload. `requireAuth` correctly derives `canSeeAllSites` from role for Corporate Admin users, but a non-admin user explicitly granted all-site access via HUB would lose that flag in the SCORVA JWT. Low risk currently since `canSeeAllSites` in `appAccess.js` is only set for Hub Admins.

**jobRole dependencies:**
| Usage | Location | Classification |
|---|---|---|
| `getScorvaRole(hubUser)` derives legacy `scorvaRole` for backward compat | `nexus/server.js` + `appAccess.js` | Keep — transitional alias, no auth use |
| `getSecurityRole(found)` builds `securityRole` in HUB session | `hub/server/routes/auth.js:65` | Keep — passes securityRole as jobRole hint to downstream apps |

---

### MASH — security-dashboard (`security-dashboard/`)

**Entry gate (before fix):**  
- Direct login called HUB at `/api/auth/login` — path does not exist on HUB; HUB mounts auth at `/auth`. Login proxy was broken.  
- No `allowedApps` check in either login or SSO path.

**Entry gate (after fix):**  
- Login now calls `${hubUrl()}/auth/login` (correct path).  
- Both login and SSO reject with 403/redirect if `allowedApps` does not include `'mash'`.

**Claims consumed from HUB token/session:**  
`role`, `siteId`, `siteIds` (all variants normalized in `auth` middleware), `canSeeAllSites`, `securityRole`.

**Site scope — reads:**  
`resolveTenantScope(req)` in `tenantScope.js` drives all reads for site-owned collections. `applyScopeFilter` applied after reads from JSON store. Relational domains use `mashDb.findMany(collection, scope)` which passes the scope directly. Strong.

**Site scope — writes:**  
`resolveWriteSiteId(req)` validates and stamps every write to site-owned collections. Per-record `assertSiteAccess` guards PATCH and DELETE. Strong.

**jobRole dependencies:**
| Usage | Location | Classification |
|---|---|---|
| `securityRole` → `wsRole` mapping drives workspace section visibility and write permissions | `server.js:199-210` | Keep — app-local authorization; workspace role is a MASH-internal concept |
| `workspace_role_mappings` allows manual per-username override | `server.js:370-378` | Keep — provides escape hatch when securityRole is insufficient |

---

### LAVA (`lava/`)

**Entry gate:**  
Both local login ([auth.js:32](../lava/server/routes/auth.js#L32)) and SSO ([auth.js:73](../lava/server/routes/auth.js#L73)) call `hasAppAccess(localUser, 'lava')` against the Postgres user. Strong.

**Claims consumed from HUB token/session:**  
LAVA is session-based. SSO enriches the session with `canSeeAllSites` and `securityRole` from the HUB token. Direct login reads both from the local DB user.

**Site scope — reads (before fix):**  
Per-record: `isSiteAllowed` used consistently throughout systems.js, hardware.js, saar.js.  
List endpoints: `buildSiteFilter` used in systems list and SAAR list.  
❌ `GET /api/hardware` without `systemId` returned all assets with no site filter.

**Site scope — reads (after fix):**  
`GET /api/hardware` without `systemId` now applies the same Corporate Admin / site-scoped / no-site pattern as systems.js.

**Site scope — writes:**  
`isSiteAllowed` guards all PATCH and DELETE operations before they execute. `resolvedSiteId` is set from the caller's allowed sites on POST. Strong.

**SAAR public submission:**  
`POST /api/saar` is intentionally unauthenticated. New SAARs are created with `siteId: null`. Site-scoped Vulcan reviewers will not see null-siteId SAARs through the list filter. In practice, SAAR review requires Vulcan role (operator/admin) which today is granted to Corporate Admin and Hub Admin who see all sites. This is a design gap worth tracking: if site-scoped LAVA operators need to review SAARs, the SAAR workflow needs a siteId assignment step.

**jobRole dependencies:**
| Usage | Location | Classification |
|---|---|---|
| `isVulcanUser` grants operator access to `Information Technology` + `Information Security` securityRoles | `authz.js:7-17` | Keep for now — app-local operator rule; should move to explicit LAVA-local permission in Phase 4 |
| `LEGACY_VULCAN_ROLES.has('Vulcan')` | `authz.js:10` | Remove when all legacy Vulcan accounts are migrated |

---

### NEXUS (`nexus/`)

**Entry gate (before fix):**  
Neither direct login nor SSO checked `allowedApps`. Any user who could authenticate with HUB could log into NEXUS.

**Entry gate (after fix):**  
- Direct login: rejects with 403 if `hubUser.allowedApps` does not include `'nexus'`.  
- SSO: redirects with `sso_error=nexus_access_denied` if `hubUser.allowedApps` does not include `'nexus'`.

**Claims consumed from HUB token/session:**  
`mapHubUser` preserves: `role`, `siteId`, `siteIds`, `canSeeAllSites` (from both claim and role-derived), `securityRole`, `allowedApps`.

**Site scope — reads:**  
`buildCyberRollup` and `buildSecurityRollup` accept a `viewer` arg and apply `{ siteId: { in: viewer.siteIds } }` Prisma filters when `canSeeAll` is false. The rollup-scoping pattern is correct.

**Site scope — writes:**  
No writes to app-operational tables. Admin writes (`PUT /api/admin/*`, `POST /api/admin/pm/*`) go to the JSON pg-store (`program_management`, `nexus_settings`) which are global/singleton, not site-owned. No site scope needed there.

**jobRole dependencies:**
| Usage | Location | Classification |
|---|---|---|
| `requireAdminRole` allows `role === 'Program Manager'` for admin write routes | `server.js:118-125` | Should move to app-local permission — `Program Manager` is a jobRole, not a hubRole |
| `securityRole === 'Program Manager'` in requireAdminRole | `server.js:121` | Same — consolidate into explicit NEXUS-local admin flag |
| `getScorvaRole(hubUser)` included in NEXUS JWT payload | `server.js:101` | Remove when NEXUS no longer needs SCORVA-derived role hints |

---

### CRATER

Not present in this repository. HUB lists CRATER in the app launcher at `process.env.CRATER_URL || 'http://localhost:3003'` with SSO path `/sso.html`. No server code audited. When CRATER's server is added, it must implement:
- `allowedApps` entry check against the HUB SSO token
- `siteIds` scope enforcement on any data it owns

---

## Audit Summary

### What currently controls app entry?

| App | Mechanism | Correct? |
|---|---|---|
| SCORVA | `hasAppAccess(user, 'scorva')` on login + SSO | ✅ |
| MASH | None (broken login URL; no allowedApps check) | ❌ → Fixed |
| LAVA | `hasAppAccess(user, 'lava')` on login + SSO | ✅ |
| NEXUS | None | ❌ → Fixed |
| CRATER | Unknown | ⚠️ Not audited |

### What claims are consumed and how is siteIds enforced?

| App | Claims consumed | Read scope enforced? | Write scope enforced? |
|---|---|---|---|
| SCORVA | role, siteId/siteIds (both variants), canSeeAllSites, securityRole | ✅ tenantHandler + missionSiteScope on all data routes | ✅ missionSiteScope stamps siteId + assertTenantDocument guards |
| MASH | role, siteId/siteIds (both variants), canSeeAllSites, securityRole | ✅ resolveTenantScope + applyScopeFilter on all site-owned collections | ✅ resolveWriteSiteId + assertSiteAccess on all writes |
| LAVA | role, siteId/siteIds, canSeeAllSites, securityRole | ✅ buildSiteFilter on lists; ✅ isSiteAllowed on single-record fetches; ❌ hardware list unfiltered when no systemId → Fixed | ✅ isSiteAllowed guards all mutations |
| NEXUS | role, siteId/siteIds, canSeeAllSites, securityRole, allowedApps | ✅ siteIds filter in both rollup builders | N/A — no site-owned write tables |
| CRATER | Unknown | Unknown | Unknown |

---

## Safe Compatibility Fixes Applied

| Fix | File | Risk |
|---|---|---|
| MASH login: changed proxy URL from `/api/auth/login` to `/auth/login` | `security-dashboard/server.js` | Low — was calling a non-existent path |
| MASH login: added `allowedApps` includes `'mash'` check | `security-dashboard/server.js` | Low — matches pattern in SCORVA and LAVA |
| MASH SSO: added `requestedApp` validation + `allowedApps` check | `security-dashboard/server.js` | Low — matches pattern in SCORVA and LAVA |
| NEXUS login: added `allowedApps` includes `'nexus'` check | `nexus/server.js` | Low — matches pattern in SCORVA and LAVA |
| NEXUS SSO: added `allowedApps` includes `'nexus'` check | `nexus/server.js` | Low — consistent with existing `requestedApp` check |
| LAVA hardware list: added site scope filter when no `systemId` | `lava/server/routes/hardware.js` | Low — matches `buildSiteFilter` pattern in systems.js |

---

## Remaining Gaps, Ordered by Risk

### High

1. **CRATER not audited.** No server code exists. If deployed, it has no known entry gate or site scope. Before CRATER goes live, it must implement `allowedApps` check on its SSO/login path.

### Medium

2. **NEXUS `requireAdminRole` grants access to `Program Manager` jobRole.** `server.js:121` checks `role === 'Program Manager'` and `securityRole === 'Program Manager'`. `Program Manager` is a `jobRole`, not a `hubRole`. A user with this jobRole gets full NEXUS admin write access (PM data, settings, KPIs). Should be moved to an explicit NEXUS-local app permission.

3. **SCORVA `/api/checklist` routes lack `tenantHandler`.** The base `checklistRouter` is mounted with `requireAuth` only. If checklist items carry `siteId`, reads are cross-site for all authenticated users. `checklistCampaignRouter` on the same path does have `tenantHandler` — verify whether the base checklist routes need it too.

4. **SCORVA `/api/aggregate` and `/api/threats` lack tenant middleware.** These are `requireAuth` only. Confirm whether aggregated data is intentionally cross-site or whether siteIds should be applied.

5. **LAVA SAAR records have `siteId: null`.** Public SAAR submissions cannot carry a siteId. Site-scoped Vulcan reviewers see zero SAARs through the list filter since the filter excludes null. In practice, SAAR review is limited to Corporate Admin / Hub Admin who have all-site access. If site-scoped operators ever need to review SAARs, a siteId assignment step needs to be added to the approval workflow.

### Low

6. **SCORVA JWT missing `canSeeAllSites` and `securityRole` claims.** `signAccessToken` does not include these. `requireAuth` derives them from role at decode time. Works correctly for all current cases (only Hub Admins have `canSeeAllSites`). Track for when a non-admin user might be granted explicit all-site access.

7. **LAVA `isVulcanUser` derives operator access from `securityRole`.** `Information Technology` and `Information Security` users automatically get Vulcan operator access. This is role-derived app authorization. Architecture §9 calls for moving to explicit app-local permission in Phase 4.

8. **`LEGACY_VULCAN_ROLES` set in LAVA `authz.js` still includes `'Vulcan'`.** Remove when all legacy Vulcan role accounts are migrated to the new model.

9. **NEXUS `getScorvaRole` in `mapHubUser`.** NEXUS includes a `scorvaRole` field in its JWT payload via `getScorvaRole(hubUser)`. This is a cross-app role dependency. Remove when NEXUS no longer needs it as a display/routing hint.

---

## Recommended Next Steps for Removing Role-Derived App Entry

1. **Complete Phase 2 (architecture doc §10):** Make `allowedApps` the only app-entry source in all apps. SCORVA, LAVA done. MASH, NEXUS now done. CRATER TBD.

2. **NEXUS — replace `requireAdminRole` Program Manager check.** Add an explicit `nexusAdmin: true` flag to the `allowedApps`/user profile model, or use a dedicated NEXUS-managed permission table. Remove jobRole from the admin gate.

3. **SCORVA — add `tenantHandler` to base `/api/checklist`.** Verify whether checklist items carry `siteId`; if so, add `tenantHandler` to the base checklist router mount.

4. **LAVA Phase 4 — replace `isVulcanUser` securityRole check.** Replace the `securityRole`-derived Vulcan operator check with an explicit LAVA app permission flag (e.g., `lava:operator` in `allowedApps` or a LAVA-managed role table).

5. **CRATER — implement entry gate and site scope before go-live.**

6. **All apps — standardize `canSeeAllSites` derivation.** Several apps independently derive this from role strings. Consider moving to trust the HUB-issued claim exclusively and removing the role-string fallbacks once all tokens include the claim explicitly.
