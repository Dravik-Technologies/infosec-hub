# Cross-App Audit Round 3 — CRATER Production Hardening
**Date:** 2026-06-05  
**Lane:** Claude — CRATER production hardening  
**Baseline:** [cross-app-audit-round2-2026-06-04.md](./cross-app-audit-round2-2026-06-04.md)

---

## 1. Local Auth Gate — Fixed

**Files changed:**
- `emass-app/server/src/routes/auth.ts`

Both `/api/auth/register` and `/api/auth/login` now return `403` when `NODE_ENV === 'production'`:

```ts
if (process.env.NODE_ENV === 'production') {
  res.status(403).json({ error: 'Local registration is disabled in production. Use HUB SSO to access CRATER.' })
  return
}
```

In development (`NODE_ENV !== 'production'`), both endpoints remain available for local testing. In production, CRATER is SSO-only.

**Impact on `userId` consistency:** With local auth blocked in production, `req.userId` will always be a HUB PostgreSQL user ID for all requests in production. MongoDB documents created via SSO will carry consistent HUB user IDs as their `userId` isolation key.

---

## 2. MongoDB Route Group Audit

### Isolation model: user-owned personal workspace

All five MongoDB route groups (`systems`, `sctm`, `poam`, `vulnerabilities`, `diagrams`) use a **user-owned isolation model**: every query filters by `{ userId: req.userId }` (and `systemId` for child records). This is a personal workspace pattern, not a shared site database.

The isolation IS working correctly:
- User A at Site 1 cannot see User B's systems — `userId` filters prevent cross-user access
- There is no cross-site data leakage — a user can only read their own documents

**This is NOT the same risk as the SCORVA/MASH/LAVA site-scope gaps from Rounds 1 and 2.** Those apps share operational records across multiple users at the same site, requiring `siteIds` filtering to prevent cross-site reads. CRATER's MongoDB workspace is personal, so user isolation already does the job.

### Route-by-route assessment

| Route group | MongoDB model | Isolation key | Cross-site gap? | Action |
|---|---|---|---|---|
| `systems.ts` | `InfoSystem` | `userId` | ❌ None — user-scoped | Add `siteId` forward-compat stamp on create |
| `sctm.ts` | `SCTMEntry` | `systemId + userId` | ❌ None | No change needed (inherits from parent system) |
| `poam.ts` | `POAMItem` | `systemId + userId` | ❌ None | No change needed |
| `vulnerabilities.ts` | `Vulnerability` | `systemId + userId` | ❌ None | No change needed |
| `diagrams.ts` | `Diagram` | `systemId + userId` | ❌ None | No change needed |

Child routes (sctm, poam, vulnerabilities, diagrams) are scoped by `systemId` which must itself belong to the user. A user cannot access another user's SCTM/POAM/vulnerabilities/diagrams because they can't access a `systemId` that isn't theirs.

The AI route (`routes/ai.ts`) similarly filters the InfoSystem lookup by `{ _id: systemId, userId: req.userId }` — correctly user-scoped. Note: the AI route is **not mounted** in `app.ts` (not registered) and is therefore effectively inactive.

### siteId forward-compat stamp — Added

**Files changed:**
- `emass-app/server/src/models/InfoSystem.ts` — added optional `siteId?: string | null` field to schema and interface
- `emass-app/server/src/routes/systems.ts` — stamped `siteId` from `req.craterUser?.primarySiteId` on system creation

New systems created via SSO will carry the user's HUB `primarySiteId`. Systems created via legacy local auth (dev only) will have `siteId: null`.

This creates a migration path: when CRATER moves to multi-user site-shared access (future work), queries can be updated from `{ userId }` → `{ siteId: { $in: userSiteIds } }` and the field will already be populated on recent documents. A migration script will be needed for older documents.

---

## 3. Canonical HUB Claims — Status

CRATER SSO tokens (issued since Round 2) now carry all canonical fields:

| Canonical field | Written to JWT? | Read by requireAuth? |
|---|---|---|
| `hubRole` | ✅ | ✅ → `req.craterUser.hubRole` |
| `jobRole` | ✅ | ✅ → `req.craterUser.jobRole` |
| `primarySiteId` | ✅ | ✅ → `req.craterUser.primarySiteId` |
| `siteIds` | ✅ | ✅ → `req.craterUser.siteIds` |
| `allowedApps` | ✅ | ✅ → `req.craterUser.allowedApps` |
| `role` (legacy alias) | ✅ kept | Read via `decoded.role` fallback |
| `siteId` (legacy alias) | ✅ kept | Read via `decoded.siteId` fallback |

Legacy local-auth tokens (dev only, `userId` only) leave `req.craterUser` undefined. This is intentional — site-scoped routes in `crater.ts` reject them via `assertSiteAccess`.

---

## 4. Complete CRATER Go-Live Checklist

### Blocking

| # | Item | Status |
|---|---|---|
| 1 | SSO `allowedApps` + `requestedApp` checks | ✅ Fixed Round 2 |
| 2 | HUB claims preserved in CRATER JWT | ✅ Fixed Round 2 |
| 3 | `requireAuth` exposes `req.craterUser` | ✅ Fixed Round 2 |
| 4 | Site scope on `/api/crater/assets` | ✅ Fixed Round 2 |
| 5 | Site scope on `/api/crater/systems/*/controls` (GET + PUT) | ✅ Fixed Round 2 |
| 6 | Site scope on `/api/crater/hydrate` | ✅ Fixed Round 2 |
| 7 | Local auth disabled in production | ✅ Fixed Round 3 |

### Non-blocking before go-live / future work

| # | Item | Risk | Notes |
|---|---|---|---|
| 8 | MongoDB routes are user-scoped (personal workspace) | Low | By design; no cross-site gap. Site-shared access requires schema migration to site-owned model |
| 9 | `siteId` null on pre-Round 3 MongoDB documents | Low | Will be stamped going forward; older docs need migration script if site-filtering is needed |
| 10 | AI route (`routes/ai.ts`) not mounted in `app.ts` | Info | Exists but is not registered; no action needed unless intentionally enabling it |
| 11 | MongoDB models not migrated to PostgreSQL | Low | Tracked in Azure migration docs; CRATER runs dual-DB (Mongo for personal workspace, PG for crater/shared) |
| 12 | `sso.html` stores token in localStorage | Low | Acceptable for SPA; migrate to httpOnly cookie when auth model matures |
| 13 | `auto-seed` and `seed-library` routes accessible to any authenticated user | Low | Currently just library data operations; consider adding a Hub Admin gate if needed in prod |

---

## 5. Code Changes Made in This Round

| File | Change |
|---|---|
| `emass-app/server/src/routes/auth.ts` | `/register` and `/login` return 403 when `NODE_ENV === 'production'` |
| `emass-app/server/src/models/InfoSystem.ts` | Added optional `siteId?: string \| null` field to interface and schema |
| `emass-app/server/src/routes/systems.ts` | System creation stamps `siteId` from `req.craterUser?.primarySiteId` |

---

## 6. Remaining Platform Risks (Non-CRATER)

These are outside this lane and deferred to Codex or a future pass:

| Item | Owner |
|---|---|
| SCORVA `signAccessToken` missing `hubRole`/`jobRole` canonical claims | Codex / SCORVA pass |
| SCORVA `/api/aggregate` legacy `role === 'Corporate Admin'` gate | Codex / SCORVA pass |
| LAVA `isVulcanUser` securityRole-derived operator gate | Future LAVA hardening pass |
| NEXUS `getScorvaRole` in JWT payload | Codex |
