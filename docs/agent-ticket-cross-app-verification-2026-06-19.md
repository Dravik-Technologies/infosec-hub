# Ticket

## Title

Cross-App Functional Verification and Database Alignment Audit

## App / Module

HUB, SCORVA, Sentinel, Nexus, LAVA, CRATER

## Type

Bug / Hardening / Verification

## Priority

High

## Background

The Security App Factory has evolved rapidly across multiple apps and shared database/auth layers. Build health has improved, but there is not yet a trustworthy statement that every major button, form, CRUD path, and site-scoped workflow is fully verified.

The immediate goal is to establish what is actually working, what is only build-healthy, what is blocked from verification, and what database or route mismatches still exist.

## Current Behavior

- Some apps build cleanly but do not have strong automated behavioral coverage.
- Sentinel currently has a stale tenant-scope test after write-hardening changes.
- CRATER cannot be fully verified in the current workspace because its TypeScript build tooling is not presently usable in the installed environment.
- Cross-app verification of button -> API -> database -> UI refresh is incomplete.

## Desired Behavior

- Every major user-facing workflow is either:
  - verified working,
  - confirmed broken with a concrete finding,
  - or explicitly marked blocked with a reason.
- Forms align to actual server/database fields.
- Site-scoped writes and reads behave correctly.
- Known verification gaps are documented and prioritized.

## Acceptance Criteria

- [ ] Build and syntax baseline documented for HUB, SCORVA, Sentinel, Nexus, LAVA, CRATER.
- [ ] Major CRUD paths are mapped from UI to API to DB for each main app.
- [ ] Verification findings are documented with severity and file references.
- [ ] Gaps caused by missing tests or blocked builds are explicitly called out.
- [ ] A prioritized remediation sequence is produced.

## Technical Notes

- Shared schema and access logic live in `packages/db`.
- Site and tenancy behavior are critical across Sentinel, SCORVA, LAVA, and HUB.
- SSO, launch, and app access are critical across HUB, Sentinel, SCORVA, and Nexus.

## Dependencies

- Local workspace buildability
- Existing Jest coverage where available
- Prisma schema inspection
- Route/page mapping

## Verification Notes

- This ticket is intended to produce a verified status report, not just a successful build report.
