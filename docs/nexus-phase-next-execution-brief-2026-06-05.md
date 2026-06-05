# NEXUS Phase Next — Data Model and Dashboard Execution Brief
**Date:** 2026-06-05  
**Audience:** Claude  
**Mode:** Execution brief  
**Objective:** Turn NEXUS from a mostly-presentational dashboard into a decision surface driven by stable rollup data from MASH, SCORVA, and NEXUS-owned program-management inputs.

---

## 1. Outcome We Want

NEXUS should answer these questions quickly:

- What is off track right now?
- Which site or program needs leadership attention?
- What decision or escalation is needed next?
- What is the source of the issue: MASH, SCORVA, or NEXUS-owned PM data?

NEXUS is **not** the operational system of record for security or cyber workflows.

Target role:

- `MASH` = physical/personnel/media/inspection operations
- `SCORVA` = cyber / RMF / ATO / POA&M operations
- `NEXUS` = cross-site rollups, program management, executive priorities, and decision support

---

## 2. Scope for This Round

Claude should stay in the **NEXUS data and dashboard lane**, not the MASH or HUB lanes.

### In scope

- Define the next stable rollup model for NEXUS
- Identify the exact source fields NEXUS needs from MASH
- Identify the exact source fields NEXUS needs from SCORVA
- Define derived metrics for decision-focused dashboards
- Define the missing NEXUS-owned program-management data model
- Produce a concrete implementation roadmap with route/view/storage recommendations

### Out of scope

- No HUB admin redesign
- No MASH route/schema refactor
- No SCORVA schema refactor
- No visual redesign work
- No generic architecture essay

This brief is for **implementation planning grounded in the current repo**.

---

## 3. Deliverables Required

Claude should produce **one markdown document**:

- `docs/nexus-phase-next-plan-2026-06-05.md`

That file should contain these sections:

### A. Current-State Inventory

Document the current NEXUS data sources in code:

- program management inputs
- MASH-backed program security rollup
- SCORVA-backed cyber rollup
- current fallbacks, gaps, and fragile areas

For each source, list:

- route/function
- storage source
- whether it is live, stored, or fallback
- whether it is site-scoped correctly
- whether it is sufficient for leadership use

### B. Required Data Model

Define the target NEXUS rollup model in concrete terms.

Must include:

- `programHealth`
- `securityPosture`
- `cyberPosture`
- `priorityQueue`
- `trendSnapshot`
- `decisionLog` or `executiveActions` if appropriate

For each model, specify:

- owner system
- source tables/collections
- key fields
- whether it is raw, derived, or stored
- recommended refresh pattern

### C. MASH Inputs Needed

List the exact data NEXUS should consume from MASH, including:

- facility status by site
- IDS issues / outages
- findings by severity and aging
- overdue activities
- upcoming activities
- training compliance
- travel / visit / VAR backlogs if present
- document exceptions
- media exceptions
- inspection readiness and open findings

For each input:

- source model/table
- minimum fields needed
- recommended aggregation logic
- whether it already exists in current MASH relational data

### D. SCORVA Inputs Needed

List the exact data NEXUS should consume from SCORVA, including:

- ATO status
- ATO expirations
- POA&M counts by severity
- POA&M aging
- vulnerabilities / findings
- control compliance if available
- hardware / workstation readiness
- SAAR backlog
- security event counts and severity

For each input:

- source model/table
- minimum fields needed
- recommended aggregation logic
- current availability in repo

### E. NEXUS-Owned PM Inputs Needed

Define the fields NEXUS itself should own for:

- portfolio summary
- budgets
- spend / burn
- contracts / programs
- milestones
- construction
- accreditations
- real-estate actions
- risks
- leadership action tracker

Call out what is currently seeded/demo data vs what should become first-class stored data.

### F. Derived Metrics

Define the minimum derived metrics that make NEXUS useful.

Must include:

- site readiness score
- cyber readiness score
- program health score
- top risks
- overdue action queue
- 30/60/90-day expirations
- trend direction
- issue aging / closure velocity where possible

For each metric:

- exact inputs
- formula or heuristic
- display placement recommendation

### G. Recommended Storage / Query Design

Recommend whether each NEXUS surface should use:

- live query
- PostgreSQL view
- materialized view
- stored snapshot table / collection

The recommendation must be practical for this repo.

### H. Execution Roadmap

Break into implementation phases with order:

1. stabilize source contracts
2. add rollup builders
3. add history/trend storage
4. expose API routes
5. wire dashboard pages
6. add operator/leadership queues

For each phase:

- files likely to change
- blocking dependencies
- verification steps

---

## 4. Constraints

Claude should follow these constraints:

- Use the current repo as the source of truth
- Prefer specific source references over generic suggestions
- Do not invent tables unless clearly marked as proposed
- Separate **required now** from **future nice-to-have**
- Favor a shared rollup layer over page-local calculations
- Preserve the architecture boundary:
  - MASH owns operational security records
  - SCORVA owns cyber operational records
  - NEXUS owns leadership rollups and PM inputs

---

## 5. Recommended Starting Points

Claude should inspect at least:

- `nexus/server.js`
- `nexus/data/nexus_settings.json`
- `nexus/client/src/pages/ProgramManagementPage.jsx`
- `nexus/client/src/pages/ProgramSecurityPage.jsx`
- `nexus/client/src/pages/ProgramCyberPage.jsx`
- `security-dashboard/server.js`
- `security-dashboard/lib/tenantScope.js`
- `packages/db/prisma/schema.prisma`
- `scorva-v1/server/routes/`
- `docs/site-tenantization.md`

---

## 6. Parallel Split With Codex

Codex is taking the **platform/UI cleanup and integration lane**.

Claude should avoid:

- editing MASH files
- editing HUB files
- broad visual redesign changes
- changing the live auth model

Claude should focus on:

- NEXUS data requirements
- rollup architecture
- dashboard usefulness
- implementation roadmap

---

## 7. Definition of Done

This task is complete when:

- `docs/nexus-phase-next-plan-2026-06-05.md` exists
- it clearly defines required data inputs from MASH, SCORVA, and NEXUS-owned PM data
- it proposes a concrete rollup/storage model
- it gives a phased implementation sequence grounded in the current repo
- it is specific enough for Codex to start implementing from it without another discovery round
