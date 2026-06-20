# Handoff Template

## From

- Agent: `release-security-engineer`
- Date: 2026-06-19
- App / Module: Cross-app release readiness

## Problem

Before any broad deployment, we need confidence that the app suite is functionally verified enough to avoid shipping broken launch, auth, CRUD, or site-scope behavior.

## Observed Behavior

- Build status is mixed but mostly healthy.
- Verification depth is uneven across apps.
- Shared auth and tenancy make cross-app regressions more expensive when missed.

## Expected Behavior

- Release readiness should be based on verified behavior, not just successful builds.
- Known blockers should prevent unsafe deployment.

## Repro Steps

1. Review engineering and integration findings.
2. Confirm build/test readiness by app.
3. Confirm DB migration/state requirements.
4. Prepare deploy or hold recommendation.

## Scope

- In scope:
  - Release readiness decision
  - Security/config checks
  - Post-deploy smoke criteria
- Not in scope:
  - Implementing feature changes

## Likely Files / Systems Involved

- Build scripts
- Dockerfiles / compose
- Prisma schema / migrations
- Azure deploy flow

## Risk Level

- Severity: High
- User impact: High
- Data/auth impact: High

## Acceptance Criteria

- [ ] Deployment blockers are explicit
- [ ] Post-deploy smoke tests are defined
- [ ] Build/test expectations are clear
- [ ] Rollback posture is understood

## Open Questions / Blockers

- Whether CRATER must be fully verified before a suite-wide release
- Whether Sentinel stale test is fixed before release

## Recommended Next Owner

- Deployment owner / platform lead
