# QA Report

## Title

Cross-App User Journey Verification Report

## Date

2026-06-19

## Agent

`qa-user-journey`

## Scope

- HUB
- SCORVA
- Sentinel
- Nexus
- LAVA
- CRATER

This report focuses on core user-impacting flows:

- login / logout / SSO
- app launch from HUB
- site switching
- create / edit / delete
- immediate UI refresh after mutation
- role and access behavior
- form to API to database alignment risk

## Personas Considered

1. Hub Admin
2. Hub User
3. Site-scoped operational user
4. Multi-site / all-sites operator

## Verification Method

This pass combines:

- build verification
- syntax verification
- existing automated test suites
- client/server route mapping
- known recent regression history from actual user reports

This is a meaningful QA audit, but not a full browser-click regression across every button in every screen.

## High-Level Status Matrix

| App | Launch/Auth | CRUD Confidence | Site Scope Confidence | Automated Verification | QA Status |
| --- | --- | --- | --- | --- | --- |
| HUB | Medium | Medium | High | Low | Partial |
| SCORVA | Medium-High | High | Medium-High | High | Best Current State |
| Sentinel | Medium | Medium | Medium | Medium | Partial with Known Gaps |
| Nexus | Medium | Medium-Low | Medium | Low | Partial |
| LAVA | Medium | Medium-Low | Medium | Low | Partial |
| CRATER | Blocked | Blocked | Blocked | Blocked | Not Fully Verifiable |

## Confirmed Healthy Findings

### 1. SCORVA build and automated baseline are strong

- Severity: Low
- Persona used: platform verifier
- Repro steps:
  1. Build SCORVA client
  2. Syntax check server
  3. Run SCORVA test suite
- Observed behavior:
  - client build succeeds
  - server syntax passes
  - Jest suite passes `59/59`
- Expected behavior:
  - green baseline for core tenant and route protections
- Likely impacted module:
  - `scorva-v1`

### 2. HUB, Sentinel, and Nexus are at least build/syntax healthy

- Severity: Low
- Persona used: platform verifier
- Repro steps:
  1. Build client where available
  2. Syntax check server
- Observed behavior:
  - HUB build succeeds
  - Sentinel client build succeeds
  - Sentinel server syntax passes
  - Nexus client build succeeds
  - Nexus server syntax passes
- Expected behavior:
  - apps are deployable/buildable at baseline
- Likely impacted module:
  - `hub`, `security-dashboard`, `nexus`

## Findings

### Finding 1

- Title: Sentinel test suite is not fully green after explicit site-write hardening
- Severity: Medium
- Persona used: multi-site operator / regression verifier
- Repro steps:
  1. Run Sentinel tests
  2. Inspect `resolveWriteSiteId` expectations
- Observed behavior:
  - one test still expects write fallback to the user’s primary site
  - implementation now intentionally requires explicit `siteId`
- Expected behavior:
  - tests should reflect the current hardened write behavior
- Screenshot or visual note:
  - automated verification mismatch, not a visible UI screenshot issue
- Likely impacted module:
  - Sentinel tenancy/write validation
- Files likely involved:
  - [security-dashboard/lib/tenantScope.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/security-dashboard/lib/tenantScope.js:158)
  - [security-dashboard/__tests__/tenantScope.test.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/security-dashboard/__tests__/tenantScope.test.js:251)

### Finding 2

- Title: CRATER cannot currently be fully verified because local build is blocked
- Severity: Medium
- Persona used: any CRATER user
- Repro steps:
  1. Run CRATER client build
  2. Run CRATER server build
- Observed behavior:
  - build fails because `tsc` is not available in the current environment
- Expected behavior:
  - CRATER should build so auth, forms, and CRUD can be verified
- Screenshot or visual note:
  - environment/tooling blocker rather than UI defect
- Likely impacted module:
  - `crater/client`, `crater/server`
- Files likely involved:
  - [crater/client/package.json](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/crater/client/package.json:7)
  - [crater/server/package.json](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/crater/server/package.json:6)

### Finding 3

- Title: HUB admin, Nexus admin, and LAVA operational flows are under-verified from a user perspective
- Severity: Medium
- Persona used: Hub Admin / Program Admin / LAVA operator
- Repro steps:
  1. Inspect repo coverage and verification artifacts
  2. Compare available tests versus operational pages/routes
- Observed behavior:
  - these apps largely build and syntax-check
  - but they do not have strong automated regression coverage behind core user actions
- Expected behavior:
  - high-risk buttons and forms should have either tests or explicit smoke verification
- Screenshot or visual note:
  - risk is “looks healthy until a real user clicks through”
- Likely impacted module:
  - `hub`, `nexus`, `lava`

### Finding 4

- Title: Sentinel still carries mixed data access patterns, increasing regression risk
- Severity: Low
- Persona used: Sentinel operator
- Repro steps:
  1. Inspect Sentinel client pages
  2. Compare `WS` relational CRUD usage versus legacy `API` usage
- Observed behavior:
  - some surfaces use the newer relational `WS` path
  - other surfaces still rely on older collection-style paths
- Expected behavior:
  - a more consistent path would reduce button-level regressions and drift
- Screenshot or visual note:
  - architectural consistency risk, not necessarily an immediate user-visible bug
- Likely impacted module:
  - Sentinel

## User Journey Notes by App

### HUB

What appears healthy:

- app builds
- main auth/session server file syntax is valid
- app filtering is tied to app access logic on `/api/apps`

What still needs user-level confirmation:

- create/edit/delete user
- app access changes reflecting correctly in portal
- launch links for each app by persona
- logout/session clearing from app-to-HUB transitions

### SCORVA

What appears healthiest:

- strongest existing automated coverage
- route mounting is comprehensive
- site middleware is consistently mounted in main server entry

What still needs explicit click-through verification:

- every add/edit/delete modal in live UI
- every site switch refresh path
- edge cases around imports and control catalog behavior

### Sentinel

What appears healthy:

- all major CRUD pages exist for core modules
- delete buttons are present across major modules
- create/edit forms are wired to CRUD endpoints

What still feels risky from a user perspective:

- stale test suite means confidence is not yet clean
- mixed old/new data access patterns
- high sensitivity around selected site and write scope

### Nexus

What appears healthy:

- buildable command surface
- server syntax OK

What still needs strong QA:

- admin console create/edit/delete
- bootstrap/load error handling in real use
- live versus fallback data source behaviors

### LAVA

What appears healthy:

- server syntax OK
- auth and site-scope hardening has been implemented in prior passes

What still needs explicit QA:

- user-facing onboarding flows
- SAAR lifecycle
- hardware CRUD and assignment paths

### CRATER

Current QA stance:

- cannot be honestly certified yet
- build/tooling blocker must be cleared before meaningful user journey verification

## Blockers

1. CRATER local buildability
2. Sentinel stale test mismatch
3. Limited automated behavioral coverage in HUB, Nexus, and LAVA
4. Some workflows may require realistic seeded data to validate meaningfully

## Recommended Next Owner

`product-manager`

## Suggested PM Framing

Group the next work into four tracks:

1. Verification repair
   - Sentinel stale test
   - CRATER buildability

2. High-risk smoke coverage
   - HUB admin flows
   - Nexus admin flows
   - LAVA operator flows

3. Operational regression checks
   - Sentinel module CRUD
   - SCORVA site-switch and modal behaviors

4. Release readiness gate
   - no suite-wide “fully verified” claim until CRATER is unblocked and the under-tested admin paths are smoke-checked
