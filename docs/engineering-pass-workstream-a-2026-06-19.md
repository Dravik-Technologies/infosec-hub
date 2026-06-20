# App Engineer Pass

## Title

Workstream A Implementation Notes

## Date

2026-06-19

## Agent

`app-engineer`

## Scope

- Sentinel verification baseline repair
- CRATER build blocker diagnosis

## Changes Made

### 1. Sentinel stale test corrected

Updated the stale tenant write expectation in:

- [security-dashboard/__tests__/tenantScope.test.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/security-dashboard/__tests__/tenantScope.test.js:254)

Old expectation:

- omitted `body.siteId` would fall back to the user primary site

Current correct behavior:

- omitted `body.siteId` throws `400`
- explicit site is required for site-owned writes

This now matches:

- [security-dashboard/lib/tenantScope.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/security-dashboard/lib/tenantScope.js:175)

### 2. CRATER build blocker diagnosed

Confirmed that both CRATER packages are missing the local TypeScript binary:

- `crater/client/node_modules/.bin/tsc` missing
- `crater/server/node_modules/.bin/tsc` missing

This indicates an environment/dependency-install blocker, not yet a code-level build script defect.

## Findings

### Finding 1

- Severity: Medium
- Title: Sentinel verification drift was caused by a stale test, not mismatched implementation
- Status: Fixed

### Finding 2

- Severity: Medium
- Title: CRATER remains blocked because local dependencies are not fully installed
- Status: Diagnosed, not yet resolved

## Assumptions

- Sentinel’s explicit-site write rule is intentional hardening and should remain in place.
- CRATER should not be classified as code-broken until dependencies are installed and a fresh build is attempted.

## Recommended Next Step

Move to `integration-verifier` after:

1. running the Sentinel test suite again,
2. installing CRATER dependencies,
3. re-attempting CRATER client and server builds.

## Manual Verification Steps

1. Run Sentinel tests:
   - `cd security-dashboard && npm test -- --runInBand`
2. Install CRATER dependencies:
   - `cd crater/client && npm install`
   - `cd ../server && npm install`
3. Retry builds:
   - `cd crater/client && npm run build`
   - `cd ../server && npm run build`
