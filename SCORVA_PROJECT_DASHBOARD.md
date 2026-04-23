# SCORVA Project Dashboard

Date: April 22, 2026
Program status: **In Progress**
Overall delivery estimate: **68%**

## Executive Snapshot

| Area | Status | Notes |
|---|---|---|
| Core platform | Green | SCORVA is operational and supports core cyber program workflows |
| Azure PostgreSQL schema | Green | Latest POA&M and Security Events migrations have been applied |
| Azure Container App deployment | Yellow | Updated image is pushed, but newest revision still needs to be activated/pulled live |
| Requirements coverage | Yellow | Strong core coverage, but automation/integrations/report packaging remain partial |
| Enterprise maturity | Yellow | Good internal platform foundation, but not yet full enterprise ISCM maturity |

## Deployment Status

| Item | Status | Detail |
|---|---|---|
| ACR image | Done | `secappfactory.azurecr.us/scorva:latest` |
| Latest pushed digest | Done | `sha256:1ea08d5a5aa6848268d962cb9560833496a98dd8f43e912f7e0f1cbd7e9a9b61` |
| Azure Postgres migration: POA&M risk fields | Done | `risk_decision` and `risk_rationale` now live |
| Azure Postgres migration: Security Events | Done | `security_events` table now live |
| Azure Container App new revision | Blocked | `saf-scorva` still shows old revision from April 21, 2026 |
| Frontend confirmation in prod | Blocked | New `Program View` and `Security Events` pages will appear after live revision updates |

## Workstream Dashboard

| Workstream | Status | Completion | Notes |
|---|---|---:|---|
| Authorization: Controls / ATO / POA&M | Green | 85% | Core flows working; formal risk workflow still partial |
| Monitoring: ConMon / Tasks / Trackers | Green | 80% | Strong base workflows in place |
| Monitoring: Security Events | Yellow | 70% | Implemented, migrated, deployed to ACR; waiting on ACA revision |
| Administration: Users / Sites / Audit / Notifications | Green | 85% | Stable and broadly complete |
| Administration: Program View | Yellow | 70% | Implemented and secured; waiting on ACA revision |
| Assets: Workstations / YubiKeys / Licenses | Green | 80% | Inventory workflows are usable; discovery still manual |
| Reporting / Exports | Yellow | 55% | Excel exports exist; evidence package export still missing |
| Threat Awareness | Yellow | 55% | NVD feed exists; no scanner/SIEM integration yet |
| Automation / Detection | Yellow | 45% | Helpful automation exists, but no asset discovery or drift detection engine |
| Compliance / Evidence Management | Yellow | 50% | Evidence fields exist; package generation not complete |

## Scope Tracker

### Done

- [x] Shared PostgreSQL Prisma schema established
- [x] Multi-site tenant-aware routing and filtering
- [x] Controls, ConMon, ATO, POA&M, Users, Sites, Agreements, Licenses, Workstations, YubiKeys modules
- [x] Audit logging across major workflows
- [x] Dashboard metrics and charts
- [x] Threat feed integration from NVD
- [x] POA&M risk decision fields added
- [x] POA&M aging notification job added
- [x] Security Events module implemented
- [x] Program View implemented for Corporate Admins
- [x] Azure PostgreSQL updated for latest schema changes
- [x] Updated SCORVA image built and pushed to ACR

### In Progress

- [ ] Activate newest Azure Container App revision for `saf-scorva`
- [ ] Verify `Program View` appears for Corporate Admin in production
- [ ] Verify `Security Events` appears under Monitoring in production
- [ ] Confirm production API route behavior on the new revision

### Not Started / Still Needed

- [ ] Formal risk workflow with approval states
- [ ] Trend analytics and risk heatmaps
- [ ] Automated compliance/evidence package export
- [ ] Data retention policy controls
- [ ] Scanner / SIEM / CMDB / ticketing integrations
- [ ] Automated asset discovery and baseline drift detection

## Immediate Next Actions

| Priority | Action | Owner | Target |
|---|---|---|---|
| P1 | Update `saf-scorva` container image to latest digest and create new ACA revision | Team | Next session |
| P1 | Validate `Program View` and `Security Events` in production | Team | Same day as revision cutover |
| P1 | Check revision health/logs after rollout | Team | Same day as revision cutover |
| P2 | Add formal risk response workflow states and review path | Backlog | Next sprint |
| P2 | Add trend views for POA&M, controls, ATOs, and events | Backlog | Next sprint |
| P3 | Define evidence package export scope | Backlog | Planning |

## Risks and Watch Items

| Risk | Severity | Mitigation |
|---|---|---|
| ACA still serving old frontend bundle | High | Force container image to exact digest and create new revision |
| `latest` tag reuse may not trigger fresh pull | High | Use digest-pinned image reference in ACA |
| Frontend bundle size is large | Medium | Add code splitting and route-level optimization later |
| Requirements may continue to expand faster than platform hardening | Medium | Keep scorecard and dashboard updated by workstream |
| Strong feature breadth but incomplete enterprise automation | Medium | Prioritize integrations and workflow maturity over more surface area |

## Success Criteria for Current Milestone

- [ ] New Azure Container App revision exists for `saf-scorva`
- [ ] `Program View` visible for Corporate Admin users
- [ ] `Security Events` visible under Monitoring
- [ ] POA&M page loads without schema errors
- [ ] Aggregate metrics endpoint returns successfully in production
- [ ] Security Events CRUD works in production

## Suggested Update Cadence

- Daily during active deployment work: deployment status, blockers, risks
- Weekly for leadership: score, completed work, next priorities
- Per release: update ACR digest, revision ID, schema changes, production validation notes
