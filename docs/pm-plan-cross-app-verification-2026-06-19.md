# Product Manager Remediation Brief

## Title

Cross-App Verification Remediation Plan

## Date

2026-06-19

## Agent

`product-manager`

## Problem Statement

The platform has a meaningful buildable baseline, but build health is still being conflated with user-ready functional correctness. The most important gap is not a single broken screen. It is that tenancy, admin mutations, launch behavior, and live CRUD confidence are uneven across apps.

If we ship based only on green builds, we risk platform-level regressions that users only discover after authentication, site switching, or data entry.

## Why It Matters

- Admin and operator trust is lost fastest when launch, access, or save/delete flows behave inconsistently.
- Multi-site tenancy errors are high-risk because they create either hidden write failures or cross-site visibility confusion.
- A partially verified platform creates expensive support loops because each new symptom has to be debugged from scratch.

## Goal

Convert the QA findings into a release-ready execution sequence that:

1. restores verification confidence where it is currently blocked,
2. closes the highest-risk user-facing gaps first,
3. avoids broad rewrites while moving each app toward a more stable operating model.

## Scope

- HUB
- SCORVA
- Sentinel
- Nexus
- LAVA
- CRATER
- shared database/runtime verification where required

## Non-Scope

- Major redesigns
- New product features unrelated to verification or platform correctness
- Re-architecting whole apps during this pass

## Delivery Principle

Prioritize root causes over symptoms. A stale test, blocked build, or mixed access path is often the real problem behind multiple user-visible bugs.

## Workstreams

### Workstream A

- Title: Verification Repair Foundation
- Priority: P0
- Severity: High
- Owner: `app-engineer`, `integration-verifier`

#### Problem

Two conditions prevent honest platform verification:

- Sentinel does not have a fully green automated baseline after write-site hardening.
- CRATER cannot be meaningfully verified while local build remains blocked.

#### In Scope

- Align Sentinel test expectations with current explicit-site write enforcement.
- Restore CRATER buildability in this workspace.
- Re-run baseline verification after both repairs.

#### Out of Scope

- Feature expansion inside CRATER
- Sentinel UX refactor

#### Acceptance Criteria

- [ ] Sentinel test suite is green with no stale expectation around primary-site fallback.
- [ ] CRATER client build succeeds locally.
- [ ] CRATER server build succeeds locally.
- [ ] A fresh verification note is produced confirming both baselines.

#### Risks

- Fixing tests without checking actual user behavior could mask a real regression.
- Restoring CRATER build may reveal additional dependency or config gaps.

### Workstream B

- Title: High-Risk Admin and Operator Smoke Coverage
- Priority: P0
- Severity: High
- Owner: `integration-verifier`

#### Problem

HUB admin, Nexus admin, and LAVA operator flows are under-verified relative to their operational importance.

#### In Scope

- HUB:
  - create user
  - edit user
  - delete user
  - app access change
  - launch link validation by role
- Nexus:
  - admin console create/edit/delete paths
  - bootstrap/fallback behavior
- LAVA:
  - SAAR lifecycle
  - hardware CRUD
  - site-scoped operator actions

#### Out of Scope

- Broad new automated test suites for all three apps in this same slice

#### Acceptance Criteria

- [ ] HUB admin smoke checklist completed with pass/fail evidence.
- [ ] Nexus admin smoke checklist completed with pass/fail evidence.
- [ ] LAVA operator smoke checklist completed with pass/fail evidence.
- [ ] Every failed step is written as a reproducible defect with file ownership guess.

#### Risks

- Manual smoke coverage can drift unless converted into reusable checklists.

### Workstream C

- Title: Tenancy and Mutation Stability
- Priority: P0
- Severity: High
- Owner: `db-tenancy-engineer`, `backend-engineer`, `frontend-engineer`

#### Problem

The biggest user-facing platform risk is still tenancy confusion around selected site, visible records, and post-mutation refresh. Sentinel and SCORVA are the most sensitive here.

#### In Scope

- Sentinel:
  - validate create/edit/delete behavior on core modules after explicit site enforcement
  - verify that selected site is honored consistently on write
  - identify remaining old `API` path surfaces vs newer relational `WS` path surfaces
- SCORVA:
  - verify site switch reload behavior across major modules
  - verify add/edit/delete flows reflect the active site filter
  - verify imported or newly created records do not appear stale across site switches

#### Out of Scope

- Complete architectural unification of all client data access patterns in this pass

#### Acceptance Criteria

- [ ] Sentinel core module CRUD is verified under both single-site and all-sites personas.
- [ ] No write route silently falls back to the wrong site.
- [ ] SCORVA major modules refresh correctly after site changes and mutations.
- [ ] Any remaining mixed-path surfaces are inventoried and prioritized.

#### Risks

- Some tenancy bugs are data-shape dependent and may require seeded multi-site fixtures.

### Workstream D

- Title: Release Gate and Verification Standard
- Priority: P1
- Severity: Medium
- Owner: `product-manager`, `release-security-engineer`

#### Problem

The platform needs a consistent definition of “verified” so we stop treating partial checks as production certification.

#### In Scope

- Define minimum release gate for each app.
- Separate:
  - buildable
  - smoke verified
  - tenant verified
  - release ready
- Require explicit blocker sign-off for any app shipped below the target gate.

#### Out of Scope

- CI pipeline redesign

#### Acceptance Criteria

- [ ] Release gate rubric exists in writing.
- [ ] Each app is classified against the rubric.
- [ ] Open blockers are visible and tied to an owner.

#### Risks

- Without discipline, teams may still default to “it builds, ship it.”

## Root-Cause Mapping

### Theme 1

- Root Cause: Verification baseline drift
- Symptoms:
  - stale Sentinel test
  - uncertainty after hardening changes

### Theme 2

- Root Cause: Environment/tooling incompleteness
- Symptoms:
  - CRATER cannot be fully verified

### Theme 3

- Root Cause: Weak behavioral verification on admin-heavy surfaces
- Symptoms:
  - HUB admin confidence gap
  - Nexus admin confidence gap
  - LAVA operator confidence gap

### Theme 4

- Root Cause: Uneven tenancy/data-path discipline
- Symptoms:
  - Sentinel mixed CRUD access paths
  - SCORVA site-switch regression risk
  - potential write/read mismatch perception across site-aware modules

## Sequencing

### Phase 1

- Workstream A
- Outcome:
  - platform can be verified honestly

### Phase 2

- Workstream B
- Outcome:
  - highest-risk admin/operator flows are proven or converted into defects

### Phase 3

- Workstream C
- Outcome:
  - tenancy-sensitive CRUD confidence is materially improved

### Phase 4

- Workstream D
- Outcome:
  - release decisions are consistent and auditable

## Suggested Next Owners

1. `app-engineer`
2. `integration-verifier`
3. `db-tenancy-engineer`
4. `release-security-engineer`

## Release Recommendation Right Now

Do not claim full cross-app verification yet.

Current recommended language:

- SCORVA: strongest current baseline
- HUB / Sentinel / Nexus / LAVA: partially verified
- CRATER: blocked until buildability is restored

## Exit Criteria For This PM Slice

- [ ] Remediation workstreams accepted
- [ ] Owners assigned
- [ ] Verification sequence agreed
- [ ] Teams move into implementation and verification passes using this brief
