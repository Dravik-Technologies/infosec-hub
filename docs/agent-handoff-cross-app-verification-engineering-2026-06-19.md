# Handoff Template

## From

- Agent: `app-engineer`
- Date: 2026-06-19
- App / Module: Cross-app verification remediation

## Problem

The suite is not yet in a state where we can say every core module action is verified. Some apps are healthy, some have stale tests or low coverage, and at least one app is blocked by local build issues.

## Observed Behavior

- HUB builds and syntax-checks, but lacks deep behavioral verification.
- SCORVA client builds, server syntax-checks, and tests pass.
- Sentinel client builds and server syntax-checks, but one tenant-scope test is stale.
- Nexus builds and syntax-checks, but lacks automated behavioral verification.
- LAVA syntax-checks but lacks deeper verification coverage.
- CRATER build is blocked because `tsc` is unavailable in the current installed environment.

## Expected Behavior

- Broken or stale verification should be repaired.
- High-risk CRUD and auth flows should be smoke-tested or covered.
- Field names and payload shapes should align with actual Prisma models.

## Repro Steps

1. Fix stale/broken verification paths first.
2. Run the highest-risk smoke paths:
   - HUB admin user management
   - Sentinel CRUD modules
   - SCORVA ATO / POAM / Controls / Tasks / Trackers
   - Nexus admin writes
3. Record true defects with file references.

## Scope

- In scope:
  - Test repair
  - Build repair
  - Route/client contract verification
  - Targeted fixes
- Not in scope:
  - Full redesign of architecture

## Likely Files / Systems Involved

- `security-dashboard/__tests__/tenantScope.test.js`
- `security-dashboard/lib/tenantScope.js`
- `crater/client/package.json`
- `crater/server/package.json`
- Main CRUD pages and route files per app

## Risk Level

- Severity: High
- User impact: High
- Data/auth impact: Medium to High

## Acceptance Criteria

- [ ] Sentinel test suite is green or intentionally updated with new expected behavior
- [ ] CRATER verification status is unblocked or explicitly documented as environment-blocked
- [ ] High-risk flows are checked end to end
- [ ] Findings are documented with severity and file references

## Open Questions / Blockers

- CRATER may require dependency repair before meaningful verification.
- Some app flows may require realistic seeded data for useful testing.

## Recommended Next Owner

- `integration-verifier`
