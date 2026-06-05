# Cross-App Audit Round 2 — Control Plane Compatibility
**Date:** 2026-06-04  
**Lane:** Claude — CRATER implementation + SCORVA middleware verification  
**Reference:** [cross-app-audit-2026-06-04.md](./cross-app-audit-2026-06-04.md) · [hub-control-plane-architecture.md](./hub-control-plane-architecture.md)

---

## 1. CRATER Status

**Location:** `emass-app/` (TypeScript, Express + Prisma/PostgreSQL + MongoDB)  
**HUB registration:** `id: 'crater'`, port 3003, SSO path `/sso.html`  
**Status: Implemented — audited and patched**

### What existed before this round

| Item | State |
|---|---|
| SSO entry gate (`allowedApps` check) | ❌ Missing — any valid HUB SSO token accepted |
| `requestedApp` validation in SSO | ❌ Missing |
| HUB claims preserved in CRATER JWT | ❌ Only `userId` + `username` were signed — all site/role/app claims stripped |
| `requireAuth` exposes HUB claims to routes | ❌ Only `req.userId` populated |
| Site scope on `/api/crater/assets` | ❌ Caller-supplied `siteId` accepted without any access check |
| Site scope on `/api/crater/systems/:id/controls` | ❌ No user siteId validation |
| Site scope on `/api/crater/hydrate` | ❌ No user siteId validation |
| Local MongoDB auth bypasses HUB entirely | ⚠️ See go-live blocker below |

### What was fixed in this round

**`emass-app/server/src/routes/auth.ts` — SSO handler:**
- Added `requestedApp !== 'crater'` check → 403 if token was issued for a different app
- Added `allowedApps.includes('crater')` check → 403 if user not entitled to CRATER
- JWT payload now includes canonical HUB claims: `hubRole`, `jobRole`, `primarySiteId`, `siteIds`, `allowedApps`
- Legacy aliases `role` and `siteId` also written to payload for backward compatibility

**`emass-app/server/src/middleware/auth.ts` — `requireAuth`:**
- Decodes all HUB claim fields from JWT
- Populates `req.craterUser` for SSO-issued tokens (presence indicates HUB-verified identity with full claims)
- Legacy local-auth tokens (`userId` only) leave `req.craterUser` undefined, which downstream helpers treat as "cannot verify site scope → deny"

**`emass-app/server/src/types/express.d.ts`:**
- Added `craterUser` to Express `Request` interface with canonical field names: `hubRole`, `jobRole`, `primarySiteId`, `siteIds`, `allowedApps`, `canSeeAllSites`

**`emass-app/server/src/routes/crater.ts` — all data routes:**
- Added `assertSiteAccess(req, siteId)` helper — respects `canSeeAllSites` for Hub Admins, enforces `siteIds` for all others, blocks legacy local-auth tokens
- `POST /hydrate`: rejects if body `siteId` is not in user's allowed sites
- `GET /systems/:externalId/controls`: loads system, validates `system.siteId` before returning controls
- `PUT /systems/:externalId/controls/:controlId`: loads system, validates `system.siteId` before updating
- `GET /assets`: validates query `siteId` is in user's allowed sites before querying workstations

### Remaining CRATER go-live blockers

**1. Local MongoDB auth completely bypasses HUB (HIGH)**  
`/api/auth/register` and `/api/auth/login` use a separate MongoDB `User` model with no connection to the shared PostgreSQL users table or HUB entitlements. A user can self-register and get a CRATER JWT with no HUB oversight.

After this round's `requireAuth` changes, local-auth JWTs (which carry only `userId`) result in `req.craterUser` being undefined. All site-scoped routes now return 403 for local-auth tokens. The `/api/crater/auto-seed` and `/api/crater/seed-library` admin routes also require auth but do not do site checks — local-auth tokens still reach them.

**Recommended action:** Disable or remove `/api/auth/register` and `/api/auth/login` in production. CRATER should be accessed exclusively via HUB SSO. If a dev-only fallback is needed, gate it behind `NODE_ENV !== 'production'`.

**2. Other CRATER route groups not yet site-scoped (MEDIUM)**  
The following route files are mounted in `app.ts` under `requireAuth` but were not audited in this round:
- `emass-app/server/src/routes/systems.ts` (`/api/systems`)
- `emass-app/server/src/routes/sctm.ts` (`/api/systems`)
- `emass-app/server/src/routes/poam.ts` (`/api/systems`)
- `emass-app/server/src/routes/vulnerabilities.ts` (`/api/systems`)
- `emass-app/server/src/routes/diagrams.ts` (`/api/systems`)

These routes use MongoDB models (`InfoSystem`, `SCTMEntry`, `POAMItem`, `Vulnerability`, `Diagram`) which are not in the shared PostgreSQL schema. Until their data model is migrated to PostgreSQL or they adopt `req.craterUser.siteIds` filtering, these routes cannot enforce site scope.

**Recommended action:** Audit each route for whether its MongoDB documents carry a `siteId`. If so, add filter using `req.craterUser.siteIds`. If not, add `siteId` to the MongoDB schema before go-live.

**3. `sso.html` stores credentials in localStorage (LOW)**  
The SSO bridge page writes `crater-token` and `crater-user` to `localStorage`. This is standard practice for SPAs but tokens in localStorage are accessible to XSS. Consider migrating to httpOnly cookie transport once CRATER's frontend auth model matures.

---

## 2. SCORVA Route Verification

### `/api/checklist` — base router (no tenant middleware)

**Routes:**
- `GET /api/checklist/templates` — lists `ChecklistTemplate` records (NIST/NISPOM control libraries)
- `GET /api/checklist/templates/:id` — single template with sections
- `GET /api/checklist/items` — checklist items filtered by `templateId`

**Verdict: ✅ SAFE — no tenant filter needed**

`ChecklistTemplate` and `ChecklistItem` are reference/library records. They represent standard control definitions (DCSA self-inspection checklists, NISPOM sections, etc.), not operational site data. These records have no `siteId` column and are intentionally global. Adding `tenantHandler` here would be incorrect.

The campaign router (`checklistCampaignRouter`), which IS site-owned, correctly has `tenantHandler` applied in `scorva-v1/server/index.js:97`. No change needed.

### `/api/aggregate` — cross-site metrics

**Route:** `GET /api/aggregate/metrics`

**Verdict: ✅ SAFE — intentionally cross-site, explicitly gated**

The route opens with:
```js
if (req.user?.role !== 'Corporate Admin') {
  return res.status(403).json({ error: 'Forbidden' });
}
```

This is a deliberate executive/admin dashboard that queries all sites and returns a ranked risk matrix. The Corporate Admin gate is correct. In the SCORVA JWT, Corporate Admin (Hub Admin) users land with `role: 'Corporate Admin'` via the SSO legacy role translation (`getLegacyPlatformRole`), so the check works correctly with current tokens.

**Forward-compatibility note:** When SCORVA's `signAccessToken` is updated to include `hubRole`, this gate should be updated to:
```js
const role = req.user?.role || ''
const hubRole = req.user?.hubRole || ''
if (role !== 'Corporate Admin' && hubRole !== 'Hub Admin') { ... }
```
Not changed in this round since `hubRole` is not yet present in SCORVA JWTs.

### `/api/threats` — external CVE feed

**Route:** `GET /api/threats/latest`

**Verdict: ✅ SAFE — external data, no site scope applicable**

Proxies the NIST NVD CVE 2.0 API with a 5-minute cache. Returns publicly available vulnerability data. No internal database queries. No site-owned data. `requireAuth` is the only gate — any authenticated SCORVA user can see the current CVE feed. This is the correct design.

---

## 3. Canonical-Claim Compatibility

New CRATER SSO tokens now use canonical field names as primary:

| Field (new) | Aliases preserved |
|---|---|
| `hubRole` | `role` (legacy) |
| `jobRole` | — |
| `primarySiteId` | `siteId` (legacy) |
| `siteIds` | — |
| `allowedApps` | — |

CRATER's `requireAuth` reads both canonical and legacy forms:
```ts
const hubRole = decoded.hubRole || decoded.role || ''
req.craterUser = {
  hubRole: hubRole || 'Hub Viewer',
  primarySiteId: decoded.primarySiteId || decoded.siteId || siteIds[0] || null,
  ...
}
```

SCORVA and LAVA touched code remains unchanged — their canonical-field migration is deferred to the pass where their JWT payload is updated (pending SCORVA `signAccessToken` change).

---

## 4. Code Changes Made in This Round

| File | Change |
|---|---|
| `emass-app/server/src/routes/auth.ts` | SSO: `requestedApp` + `allowedApps` checks; canonical HUB claims in JWT |
| `emass-app/server/src/middleware/auth.ts` | `requireAuth`: decode and expose `craterUser` with all HUB claim fields |
| `emass-app/server/src/types/express.d.ts` | Added `craterUser` to Express `Request` interface |
| `emass-app/server/src/routes/crater.ts` | `assertSiteAccess` helper; site-scope enforcement on `/hydrate`, `/systems/*/controls` (GET + PUT), `/assets` |

---

## 5. Remaining Risks — Ordered by Severity

### Critical

_(none new — all critical CRATER gaps are either fixed or explicitly documented as blockers above)_

### High

1. **CRATER local auth (`/api/auth/register` + `/api/auth/login`)** — self-registration via MongoDB, no HUB oversight. Site-scoped routes now return 403 for local-auth tokens, but the auth endpoints themselves still exist. Disable in production.

### Medium

2. **CRATER `systems/sctm/poam/vulnerabilities/diagrams` routes** — MongoDB-backed routes not yet site-scoped. Must be audited before CRATER handles multi-site users in production.

3. **SCORVA `/api/aggregate` Corporate Admin check** — uses legacy `role === 'Corporate Admin'` string. Needs dual-check (`hubRole === 'Hub Admin'` too) when SCORVA JWTs begin carrying `hubRole`.

4. **SCORVA `signAccessToken` still missing `hubRole`, `jobRole`, `canSeeAllSites`** — SCORVA JWTs lack canonical claim names. Until updated, SCORVA tokens are backward-compatible but not forward-compatible with the canonical HUB claim contract.

### Low

5. **CRATER `sso.html` localStorage token storage** — acceptable short-term; track for httpOnly cookie migration.

6. **LAVA `isVulcanUser` securityRole gate** — identified in Round 1; no change in this round.

7. **NEXUS `getScorvaRole` in JWT payload** — cross-app role dependency; no change in this round (Codex owns NEXUS lane).
