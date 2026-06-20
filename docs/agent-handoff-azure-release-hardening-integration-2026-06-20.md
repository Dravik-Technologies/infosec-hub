## From

- Agent: `integration-verifier`
- Date: 2026-06-20
- App / Module: Cross-app Azure release hardening

## Problem

The current release candidate has meaningful hardening work in place, but integration confidence is still uneven. The SCORVA/HUB surfaces are buildable and the shared auth/schema hardening artifacts are present, yet the suite is not fully end-to-end verified as a single Azure-ready release train.

## Observed Behavior

- Shared auth hardening artifacts are present in code:
  - `cookie-parser` mounted in `nexus/server.js`, `security-dashboard/server.js`, `scorva-v1/server/index.js`
  - `tokenEpoch` support present in Prisma schema and middleware
  - `HubSsoToken` model exists in shared schema
- SCORVA control-catalog/site-control phase is wired into the codebase:
  - new routes: `scorva-v1/server/routes/control-catalog.js`, `site-controls.js`
  - server usage of `db.siteControlImplementation` is widespread
  - migration directory exists: `packages/db/prisma/migrations/20260619183000_scorva_control_catalog_phase1/`
- Build/syntax verification completed locally:
  - `node --check scorva-v1/server/index.js` ✅
  - `node --check hub/server/index.js` ✅
  - `scorva-v1/client` production build ✅
  - `hub/client` production build ✅
- Current worktree is still dirty and release-sensitive:
  - schema changed: `packages/db/prisma/schema.prisma`
  - many SCORVA UI/server files modified
  - migration not merely cosmetic; runtime depends on it
- Verification depth is still partial:
  - no direct browser-driven proof here that all SCORVA/HUB/NEXUS/Sentinel user journeys pass after the latest changes
  - no fresh Azure smoke verification captured in this pass

## Expected Behavior

- A release-hardening candidate should have:
  - cleanly buildable release artifacts
  - explicit DB migration dependency documented
  - confirmed auth/session hardening present
  - verified post-change functional smoke for launch, CRUD, site switching, logout, and visibility
  - clear go / no-go call for Azure

## Repro Steps

1. Inspect current release-hardening code paths and shared schema/auth artifacts.
2. Check worktree state for release-sensitive changes.
3. Run syntax verification on critical servers.
4. Run production builds on critical clients.
5. Compare results against Azure release expectations.

## Scope

- In scope:
  - Integration readiness signals for Azure release hardening
  - Build/syntax verification
  - Shared schema/auth dependency review
  - Remaining runtime risks
- Not in scope:
  - Full manual QA of every module
  - Executing Azure deployment in this pass
  - Applying missing DB migrations in production from this handoff

## Likely Files / Systems Involved

- Frontend:
  - [hub/client](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/client)
  - [scorva-v1/client](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client)
- Backend:
  - [hub/server](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/server)
  - [scorva-v1/server](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/server)
  - [security-dashboard/server.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/security-dashboard/server.js)
  - [nexus/server.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/nexus/server.js)
- Database / Prisma:
  - [packages/db/prisma/schema.prisma](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/packages/db/prisma/schema.prisma)
  - [packages/db/prisma/migrations/20260619183000_scorva_control_catalog_phase1/migration.sql](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/packages/db/prisma/migrations/20260619183000_scorva_control_catalog_phase1/migration.sql)
  - [packages/db/src/tokenEpochCache.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/packages/db/src/tokenEpochCache.js)
- Infra / Auth:
  - HUB SSO token issuance / verification path
  - Azure Container Apps revisions
  - Azure PostgreSQL schema state

## Pass / Fail Matrix

- `SCORVA server syntax`:
  - Result: `PASS`
  - Evidence: `node --check scorva-v1/server/index.js`
- `HUB server syntax`:
  - Result: `PASS`
  - Evidence: `node --check hub/server/index.js`
- `SCORVA client production build`:
  - Result: `PASS with warning`
  - Evidence: Vite build completed; chunk-size warning only
- `HUB client production build`:
  - Result: `PASS`
  - Evidence: Vite build completed
- `Shared auth hardening artifacts present in code`:
  - Result: `PASS`
  - Evidence: `cookie-parser`, `tokenEpoch`, `HubSsoToken` references present
- `SCORVA control-catalog runtime migration dependency identified`:
  - Result: `PASS`
  - Evidence: code and migration both present
- `Azure runtime schema confirmed in this pass`:
  - Result: `FAIL / NOT VERIFIED`
  - Evidence: no live DB check performed in this pass
- `Cross-app post-change smoke verification`:
  - Result: `FAIL / NOT VERIFIED`
  - Evidence: no direct browser/API smoke matrix executed in this pass
- `Release worktree cleanliness`:
  - Result: `FAIL`
  - Evidence: substantial modified and untracked files remain

## Risk Level

- Severity: High
- User impact: High if deployed without schema/state alignment
- Data/auth impact: High because SCORVA now depends on shared schema additions and shared auth hardening

## Regressions Found

- No new build-breaking regressions were found in HUB or SCORVA during this pass.
- A release-process regression remains: runtime success still depends on schema migration state, and that dependency is easy to miss because the clients build successfully even if production DB state lags.

## Remaining Risk

- The biggest unresolved release risk is not compilation; it is environment alignment.
- If Azure PostgreSQL does not have `site_control_implementations` and related schema in place, SCORVA controls will fail at runtime even though the app builds.
- The suite still lacks a fresh, captured post-change smoke pass covering:
  - HUB portal launch
  - SSO into SCORVA / Sentinel / NEXUS
  - logout behavior
  - site selector visibility and switching
  - CRUD refresh behavior
  - role/site visibility

## Acceptance Criteria

- [x] Critical HUB and SCORVA build artifacts compile
- [x] Shared auth hardening artifacts are present in code
- [x] DB migration dependency is explicit
- [ ] Azure runtime DB schema is confirmed against the release target
- [ ] Post-deploy or pre-deploy smoke matrix is executed across the affected apps
- [ ] Dirty worktree is reduced to the intended release scope or explicitly bundled into one controlled release

## Open Questions / Blockers

- Has the Azure target DB definitely had `20260619183000_scorva_control_catalog_phase1` applied for the intended environment?
- Are Nexus, Sentinel, and HUB current live revisions aligned with the same shared auth/schema expectations as SCORVA?
- Is this release intended to include all current modified files, or only the SCORVA/HUB subset?

## Recommended Next Owner

- `azure-release-engineer`
  - only after DB migration state and smoke-scope are confirmed
