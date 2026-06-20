## Product Manager Handoff

Source: [docs/qa-scorva-user-journey-2026-06-20.md](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/docs/qa-scorva-user-journey-2026-06-20.md)
Date: 2026-06-20
From role: `qa-user-journey`
To role: `product-manager`
Product: `SCORVA`

### Problem statement

SCORVA is functionally rich, but it still contains a few architectural seams where app-local behavior can drift away from the HUB identity model. The QA pass found two release-critical patterns:

1. SCORVA can write directly to the shared user identity table using its own local role taxonomy.
2. Several site/admin UX capabilities are still keyed off legacy `Corporate Admin` strings instead of effective scope claims like `canSeeAllSites`.

There is also one important inspection workflow UX issue where checklist items can appear to jump or disappear during status updates.

### Why it matters

- Identity drift in SCORVA can recreate the same cross-app role mismatch problem that has already caused user confusion.
- Scope-gating drift means the wrong people may lose site selector/admin functionality even when backend access says they should have it.
- Inspection jumpiness makes the self-inspection workflow feel unreliable and can damage operator trust during live audits.

### Scope

#### P0: Remove SCORVA as a competing source of truth for shared user identity

- Review whether SCORVA `Users` should:
  - become read-only for shared identity fields, or
  - be limited to app-local metadata only
- Do not allow SCORVA to redefine shared HUB role semantics if HUB is canonical
- Validate whether SCORVA should be allowed to set local passwords at all

Acceptance criteria:

- Editing a user inside SCORVA cannot silently redefine shared HUB identity role semantics.
- Shared role/title/app access values remain canonical to HUB.
- Any SCORVA-specific permission remains clearly app-scoped.

#### P0: Replace legacy role-name UI gating with effective-scope/capability gating

- Update the following to use canonical effective scope:
  - sidebar site selector
  - sites admin page
  - program view tab exposure
  - inspection campaign create/edit affordances
- Align frontend checks with backend permission rules

Acceptance criteria:

- Any user with effective all-site scope sees the site selector consistently.
- Any user without that scope does not.
- Program View, Sites, and inspection admin controls appear based on capability, not a fragile role string.

#### P1: Stabilize inspection campaign item UX after save

- Prevent the active checklist item from appearing to disappear without explanation
- Options:
  - optimistic local state patch before refetch
  - preserve scroll/focus and show “moved by filter” message
  - defer refetch until save batch/section exit

Acceptance criteria:

- Changing an item status does not feel like the current question vanished unexpectedly.
- If the item leaves the current filtered view, the UI tells the user why.

### Non-scope

- Full visual redesign of SCORVA
- Broad backend permission redesign across all apps
- New inspection template content beyond workflow stabilization

### Suggested owners

- Identity/source-of-truth fix: full-stack + DB owner
- Scope-gating cleanup: frontend + auth owner
- Inspection item UX stabilization: frontend owner for Checklist Library

### Risks

- If SCORVA keeps direct write authority over shared user records, future HUB cleanup work can be undone from inside the app.
- If role-string gating stays in place, broad-scope user behavior will keep regressing whenever claims or naming evolve.

### Recommended execution order

1. Lock down SCORVA user-management semantics against HUB drift.
2. Normalize site/admin gating to effective scope across the app shell and admin surfaces.
3. Fix checklist item save/refetch behavior for inspection workflow stability.

### Release recommendation

- Do not treat SCORVA as fully QA-signed-off until the two P0 issues are resolved.
- The inspection-item issue is important but should follow immediately after the P0 identity/scope corrections.
