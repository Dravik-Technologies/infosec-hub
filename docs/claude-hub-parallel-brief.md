# Claude Execution Brief — HUB Control Plane Simplification

**Date:** 2026-06-04  
**Objective:** Move the platform toward a cleaner "HUB as identity/control plane" model while keeping downstream apps independently responsible for their own data and authorization.

Codex and Claude should work in parallel on separate lanes.

---

## Outcome We Want

We are standardizing toward this model:

- `HUB` = identity, SSO, app entitlements, site memberships, admin console
- `SCORVA`, `MASH`, `LAVA`, `NEXUS`, `CRATER` = independently owned operational apps
- `allowedApps` = app entry permission
- `siteIds` = data scope
- `hubRole` = HUB authority
- `jobRole` = descriptive / limited app-functional hint

Reference doc:

- [docs/hub-control-plane-architecture.md](./hub-control-plane-architecture.md)

Current HUB transitional claim shape to expect during the audit:

- canonical: `authVersion`, `hubRole`, `jobRole`, `primarySiteId`, `siteIds`, `allowedApps`
- compatibility aliases still present: `role`, `securityRole`, `siteId`, `site`

Claude should prefer the canonical fields in any new work, but may preserve legacy aliases where required for compatibility.

---

## Claude Lane

Claude should take the **cross-app audit and compatibility lane**.

Do **not** restructure the HUB admin UI in this pass. Codex is handling the HUB-side simplification lane.

### Claude tasks

1. Audit every app for entry authorization

Check whether each app explicitly validates that the current user is entitled to that app:

- `scorva-v1`
- `security-dashboard` (MASH)
- `lava`
- `nexus`
- `crater`

For each app, answer:

- what currently controls app entry?
- does it check `allowedApps` directly?
- does it still rely on role-derived access?
- where are the gaps?

2. Audit every app for site-scope enforcement

For each app, answer:

- what claims are consumed from HUB token/session?
- is `siteIds` enforced for reads?
- is `siteIds` enforced for writes?
- does any route still allow broader access than intended?

3. Audit `jobRole` dependencies

For each app, identify all places where `securityRole` / `jobRole` is currently used for:

- app entry
- admin UI visibility
- workflow role mapping
- per-record authorization

Classify each usage:

- keep for now
- should move to app-local permission later
- should be removed

4. Produce a compatibility matrix

Add a section to the architecture docs or a new companion doc that lists, app by app:

| App | Entry gate | Site scope | Job role dependency | Action needed |
|---|---|---|---|---|

5. Make only safe compatibility fixes

Claude may implement low-risk fixes if they are clearly in-scope and isolated, especially:

- missing `allowedApps` entry checks
- missing preservation of `siteIds`
- missing claim normalization in auth/session middleware

Avoid broad UI rewrites and avoid changing the HUB admin page structure in this lane.

---

## Codex Lane

Codex is handling:

- HUB terminology simplification
- HUB control-plane architecture doc
- HUB admin model cleanup
- explicit entitlements as the canonical app-entry model

Claude should assume Codex may be editing:

- `hub/client/src/pages/AccessAdmin.jsx`
- `hub/server/routes/admin.js`
- `packages/db/src/appAccess.js`
- docs under `docs/`

If Claude needs to edit docs, prefer adding new sections rather than rewriting Codex-owned sections.

---

## Constraints

- Do not revert unrelated local changes
- Preserve current production compatibility wherever possible
- Favor explicit `allowedApps` checks over role-derived app-entry logic
- Keep app-local authorization inside each app
- Do not move operational logic into HUB

---

## Deliverables From Claude

Claude should return:

1. a cross-app audit summary
2. any safe compatibility fixes made
3. remaining gaps, ordered by risk
4. recommended next steps for removing role-derived app entry

---

## Definition of Done

This lane is complete when:

- every app has been audited for app-entry gating
- every app has been audited for site-scope enforcement
- current `jobRole` dependencies are documented
- safe compatibility fixes are applied where obvious
- remaining work is clearly listed for the next pass
