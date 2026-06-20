# Security App Factory Agent Operating Model

This document explains how to run specialized agents across HUB, SCORVA, Sentinel, Nexus, LAVA, and CRATER without the work becoming chaotic.

## Core Recommendation

Start with 5 agents:

1. QA User Journey Agent
2. Product Manager Agent
3. App Engineer Agent
4. DB / Tenancy Engineer Agent
5. Release / Security Engineer Agent

This is enough specialization to improve quality without creating handoff overhead.

## Why This Works

- QA catches real user pain before engineers solve the wrong problem.
- PM turns messy findings into clear acceptance criteria.
- App Engineer handles most implementation quickly.
- DB / Tenancy Engineer protects schema integrity and site isolation.
- Release / Security Engineer keeps Azure, secrets, auth, and rollout safe.

## When to Expand

Split `App Engineer` into separate `Frontend Engineer` and `Backend Engineer` when:

- a task spans multiple apps
- UI and API work can happen in parallel
- auth and tenancy changes are mixed with visual changes

Add `Integration Verifier` whenever the bug smells like:

- save worked but UI didn’t refresh
- site switch shows stale data
- delete worked in DB but card still renders
- frontend and backend field names drifted

## Handoff Standard

Use `.agents/templates/handoff-template.md`.

Mandatory fields:

- Problem
- Observed behavior
- Expected behavior
- Repro steps
- Scope
- Files likely involved
- Risk level
- Acceptance criteria
- Blockers

## Suggested Real-World Usage

### Example: Sentinel site-write bug

1. QA User Journey Agent reproduces wrong-site write.
2. Product Manager Agent defines acceptance criteria.
3. App Engineer updates the form and API call behavior.
4. DB / Tenancy Engineer verifies explicit `siteId` write enforcement.
5. Integration Verifier checks create/edit/delete and site switch.
6. Release / Security Engineer deploys.

### Example: HUB access control issue

1. QA User Journey Agent reproduces missing app launch or bad logout behavior.
2. Product Manager Agent frames it as identity + launch issue.
3. Backend Engineer checks session, app access, and launch URL construction.
4. DB / Tenancy Engineer verifies allowed apps / site metadata.
5. Integration Verifier tests HUB -> app launch end to end.
6. Release / Security Engineer deploys and verifies in Azure.

## Repo Structure

See `.agents/` for:

- role cards
- handoff templates
- QA and release checklists
- default workflows

## Practical Prompting Pattern

When assigning work to Claude or another model, send:

1. The relevant role file from `.agents/roles/`
2. The handoff or ticket
3. The exact app/module
4. The acceptance criteria
5. Any constraints

That should sharply reduce repeated failed attempts and vague outputs.
