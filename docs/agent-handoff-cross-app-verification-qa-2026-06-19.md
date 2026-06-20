# Handoff Template

## From

- Agent: `qa-user-journey`
- Date: 2026-06-19
- App / Module: Cross-app

## Problem

We do not yet have a trustworthy end-to-end picture of which core user workflows across the app suite actually work versus which only appear healthy from builds or partial tests.

## Observed Behavior

- Users have previously reported launch issues, stale site switching, stale deletes, missing refreshes, and confusing role/app-access behavior.
- Recent development has touched HUB, SCORVA, Sentinel, Nexus, and shared DB logic.
- Multiple regressions have historically looked fixed in code but were still broken in actual flows.

## Expected Behavior

- Core user workflows should be testable by persona.
- Each reported issue should be reproducible or disproven with steps.
- UX confusion should be captured even when the backend is technically correct.

## Repro Steps

1. Log into HUB as Hub Admin, Hub User, and site-scoped user where possible.
2. Launch each app from HUB.
3. Exercise create, edit, delete, site switch, and logout where available.
4. Record any mismatch between displayed data and expected site scope.

## Scope

- In scope:
  - Login/logout/launch
  - Site selector behavior
  - Create/edit/delete flows
  - Immediate UI refresh after mutation
  - Role-based visibility
- Not in scope:
  - Deep schema redesign
  - Aesthetic-only design opinions unless they block clarity

## Likely Files / Systems Involved

- Frontend: all primary app pages
- Backend: app auth and CRUD routes
- Database / Prisma: `packages/db/prisma/schema.prisma`
- Infra / Auth: session, JWT, SSO launch

## Risk Level

- Severity: High
- User impact: High
- Data/auth impact: Medium to High

## Acceptance Criteria

- [ ] Repro notes exist for each core app
- [ ] Persona-based findings are captured
- [ ] Site-scope issues are clearly identified
- [ ] Mutation refresh issues are clearly identified

## Open Questions / Blockers

- CRATER may be partially blocked by local build limitations.
- Some flows may require seeded or live data to validate properly.

## Recommended Next Owner

- `product-manager`
