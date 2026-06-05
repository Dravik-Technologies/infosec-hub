# Claude Execution Brief — Round 2

**Date:** 2026-06-04  
**Objective:** Continue the control-plane migration by closing the highest-risk downstream gaps identified in the cross-app audit, without overlapping Codex's HUB and NEXUS permission-model lane.

Use this document together with:

- [cross-app-audit-2026-06-04.md](./cross-app-audit-2026-06-04.md)
- [hub-control-plane-architecture.md](./hub-control-plane-architecture.md)

---

## Codex / Claude Split

### Codex owns in this round

- HUB SSO/session contract cleanup
- HUB terminology and identity model simplification
- NEXUS permission-model cleanup
- architectural docs for the control-plane model

### Claude owns in this round

- CRATER access model implementation or readiness audit
- SCORVA middleware verification and safe site-scope fixes
- any low-risk downstream compatibility fixes that directly support the new HUB claim model

Do **not** restructure the HUB admin UI and do **not** take the NEXUS admin-permission redesign lane in this round.

---

## Current HUB Transitional Claim Shape

Prefer these canonical fields in any new work:

- `authVersion`
- `hubRole`
- `jobRole`
- `primarySiteId`
- `siteIds`
- `allowedApps`

Compatibility aliases may still be present and may still be needed short-term:

- `role`
- `securityRole`
- `siteId`
- `site`

Rule for this round:

- prefer canonical fields when adding or fixing code
- preserve compatibility aliases if existing app code still relies on them

---

## Claude Tasks

### 1. CRATER lane — highest priority

If CRATER server code exists in another branch, folder, or deferred location accessible to Claude, audit it. If not, document that clearly and create a readiness checklist.

For CRATER, determine:

- how users authenticate
- whether it validates `allowedApps`
- how it consumes site claims
- whether its data model is site-scoped

If code exists, implement the minimum contract:

1. app-entry gate using `allowedApps` and `requestedApp`
2. site-scope enforcement using `siteIds`
3. preference for canonical HUB claim fields

If code does **not** exist, deliver:

- a go-live blocker note
- a minimal server contract checklist
- the exact required access checks for CRATER day one

### 2. SCORVA lane — verify and fix site middleware gaps

Audit these areas called out in the cross-app audit:

- base `/api/checklist`
- `/api/aggregate`
- `/api/threats`

For each:

- confirm whether the route returns site-owned data
- confirm whether `tenantHandler` and/or `missionSiteScope` should apply
- if omission is unsafe, implement the lowest-risk fix

Priority:

1. fix cross-site exposure if present
2. avoid changing intended enterprise/global routes unless clearly necessary

### 3. Canonical-claim compatibility

Where Claude touches downstream auth/session code, prefer:

- `hubRole` over `role`
- `jobRole` over `securityRole`
- `primarySiteId` over `siteId`

But preserve legacy fallback reads so current production tokens still work.

### 4. Documentation deliverable

Update the audit baseline or add a short follow-up doc section covering:

- what CRATER does or does not have yet
- which SCORVA routes were verified
- which SCORVA routes were fixed
- whether canonical HUB fields are now accepted in the touched apps

---

## Constraints

- Do not modify HUB admin UI structure
- Do not redesign NEXUS admin permissions in this round
- Do not revert unrelated work
- Favor low-risk, explicit access checks
- Keep app-local authorization inside the app

---

## Deliverables

Claude should return:

1. CRATER status:
   - implemented, audited, or blocked by missing code
2. SCORVA verification summary:
   - safe
   - fixed
   - intentionally cross-site
3. any code changes made
4. remaining risks ordered by severity

---

## Definition of Done

This round is complete when:

- CRATER is either audited/fixed or explicitly documented as a go-live blocker
- SCORVA checklist/aggregate/threat routes are verified
- any unsafe SCORVA site-scope omissions are patched
- touched downstream code accepts the canonical HUB claim fields with compatibility fallback

