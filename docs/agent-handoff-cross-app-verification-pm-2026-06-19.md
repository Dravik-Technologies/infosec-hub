# Handoff Template

## From

- Agent: `product-manager`
- Date: 2026-06-19
- App / Module: Cross-app verification program

## Problem

The platform needs a real verification pass that distinguishes build health from functional correctness, especially across tenancy, launch, auth, CRUD, and UI refresh behavior.

## Observed Behavior

- SCORVA is currently the strongest app from a verification standpoint.
- Sentinel has a known stale test after stricter write-site enforcement.
- Hub, Nexus, and LAVA are comparatively under-tested in behavior.
- CRATER is currently blocked from full verification in this workspace.

## Expected Behavior

- We should know exactly which issues are true defects, which are test gaps, and which are environment blockers.
- Work should be prioritized by operational risk and user impact.

## Repro Steps

1. Review QA findings.
2. Group findings into root-cause themes:
   - Auth / launch
   - Site scope / tenancy
   - Form-to-schema mismatches
   - Mutation refresh failures
   - Blocked verification
3. Convert each theme into an implementation-ready brief.

## Scope

- In scope:
  - Prioritization
  - Acceptance criteria
  - Owner assignment
  - Sequencing
- Not in scope:
  - Writing code

## Likely Files / Systems Involved

- `hub/`
- `scorva-v1/`
- `security-dashboard/`
- `nexus/`
- `lava/`
- `crater/`
- `packages/db/`

## Risk Level

- Severity: High
- User impact: High
- Data/auth impact: High

## Acceptance Criteria

- [ ] Findings grouped into root issues
- [ ] Severity assigned
- [ ] Suggested owner assigned
- [ ] Remediation order defined

## Open Questions / Blockers

- Whether CRATER environment should be repaired before broader feature work.
- Whether additional automated smoke coverage is desired immediately.

## Recommended Next Owner

- `app-engineer`
- `db-tenancy-engineer`
- `integration-verifier`
