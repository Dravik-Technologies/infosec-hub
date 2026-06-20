# Agent Operating System

This folder defines a lightweight multi-agent workflow for the Security App Factory.

Use this when a task should move through discovery, implementation, verification, and release without losing context between people or models.

## Recommended Core Agents

1. `qa-user-journey`
2. `product-manager`
3. `app-engineer`
4. `db-tenancy-engineer`
5. `release-security-engineer`
6. `azure-release-engineer`

## Optional Expanded Agents

1. `frontend-engineer`
2. `backend-engineer`
3. `integration-verifier`

## Folder Layout

- `roles/`
  Agent role cards, responsibilities, inputs, outputs, and guardrails.
- `templates/`
  Reusable handoff, ticket, QA, and deploy templates.
- `workflows/`
  Recommended execution order for common delivery patterns.

## Default Workflow

For most work in this repo:

`qa-user-journey -> product-manager -> app-engineer -> db-tenancy-engineer -> integration-verifier -> release-security-engineer`

If the change is being deployed to Azure, append:

`-> azure-release-engineer`

If the task is mostly UI:

`qa-user-journey -> product-manager -> frontend-engineer -> integration-verifier -> release-security-engineer`

If the change is being deployed to Azure, append:

`-> azure-release-engineer`

If the task is mostly auth / tenant / schema:

`qa-user-journey -> product-manager -> backend-engineer -> db-tenancy-engineer -> integration-verifier -> release-security-engineer`

If the change is being deployed to Azure, append:

`-> azure-release-engineer`

## Handoff Rules

Every agent should hand off using `templates/handoff-template.md`.

No handoff is complete unless it includes:

- Problem
- Observed behavior
- Expected behavior
- Repro steps
- Scope
- Files likely involved
- Risk level
- Acceptance criteria
- Open questions / blockers

## App Ownership Guidance

- `hub`
  Identity, access, SSO, app launch, admin console.
- `scorva-v1`
  Cyber / RMF / ATO / POAM / controls / trackers.
- `security-dashboard`
  Sentinel security operations workspace.
- `nexus`
  Executive / portfolio / rollup dashboards.
- `lava`
  SAAR / onboarding / hardware access.
- `crater`
  eMASS / RMF workspace.
- `packages/db`
  Shared Prisma schema, database models, migrations, app access logic.

## Practical Usage

When you want Codex to act as one of these agents, send:

1. The role file from `roles/`
2. The current ticket or handoff
3. The acceptance criteria
4. The app/module scope

That keeps work disciplined and reduces repeated failed attempts.

## Lightweight Workflow Automation

If you want less manual stepping between roles, use:

```bash
./agent-workflow.sh modes
./agent-workflow.sh start multi-app-rollout "cross-app verification and release readiness"
./agent-workflow.sh status
./agent-workflow.sh next
./agent-workflow.sh run-next
./agent-workflow.sh prompt
./agent-workflow.sh advance
./agent-workflow.sh advance-and-run
./agent-workflow.sh log-result completed docs/security-report.md "no critical blockers"
./agent-workflow.sh results
./agent-workflow.sh latest-report
./agent-workflow.sh reset
```

What it does:

- tracks the current role in a simple local state file
- tracks the workflow mode and task label
- tells you which agent should run next
- prints the next role card path and suggested template
- prints a ready-to-paste Codex continuation prompt
- keeps a run folder under `.tmp/agent-workflow/runs/`
- can log artifacts like security reports, QA notes, and release checklists
- lets a single Codex session move role-by-role with less friction

What it does not do:

- it does not spawn independent Codex workers by itself
- it does not replace engineering judgment
- it does not automatically edit code without an active Codex session

Best use:

1. Run `./agent-workflow.sh start <mode> "<task>"`
2. Run `./agent-workflow.sh run-next`
3. Paste the generated prompt back into Codex
4. After that pass is complete, run `./agent-workflow.sh advance`
5. Run `./agent-workflow.sh run-next` again

If you want one-step progression:

```bash
./agent-workflow.sh advance-and-run
```

That advances to the next role and immediately prints the next role card, template, and Codex continuation prompt.

Supported modes:

- `small-bug`
- `db-tenant-auth`
- `ui-refresh`
- `multi-app-rollout`

Example:

```bash
./agent-workflow.sh start ui-refresh "Sentinel inspection UX polish"
./agent-workflow.sh run-next
```

Output:

```text
Workflow mode: ui-refresh
Current step: 0
Task: Sentinel inspection UX polish
Next role: qa-user-journey
Role card: /.../.agents/roles/qa-user-journey.md
Suggested template: /.../.agents/templates/qa-checklist.md
Prompt Codex with:
continue as qa-user-journey for: Sentinel inspection UX polish
```

This is not fully autonomous process spawning, but it is the cleanest way to make one Codex session hand work from one role to the next with almost no manual bookkeeping.

## Where Results Go

Each `start` command now creates a run folder:

```text
.tmp/agent-workflow/runs/<timestamp>-<task-slug>/
```

Inside it:

- `metadata.md`
- `results.md`
- `artifacts/`

Examples:

```bash
./agent-workflow.sh start multi-app-rollout "azure release hardening"
./agent-workflow.sh log-result completed docs/agent-handoff-cross-app-verification-release-2026-06-19.md "security signoff recorded"
./agent-workflow.sh results
./agent-workflow.sh latest-report
```

Use this especially for:

- security findings before Azure deployment
- release checklists
- verification reports
- rollback notes

## Azure Deployment Ownership

- `release-security-engineer`
  Security gate, release readiness, checklist, rollback review.
- `azure-release-engineer`
  Actual Azure deployment execution, image/revision tracking, post-deploy smoke check.
