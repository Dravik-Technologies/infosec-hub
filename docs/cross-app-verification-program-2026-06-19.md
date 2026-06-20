# Cross-App Verification Program

This document is the working brief for verifying the Security App Factory suite beyond simple build success.

## Objective

Establish a truthful status for:

- Which apps build
- Which apps are syntax-valid
- Which apps have meaningful automated coverage
- Which high-risk buttons and workflows are actually verified
- Which issues are product defects versus environment blockers

## Current Baseline

### Verified healthy at build/syntax level

- HUB
- SCORVA client/server
- Sentinel client/server
- Nexus client/server
- LAVA server

### Verified healthy at automated test level

- SCORVA: passing suite

### Known verification issue

- Sentinel: one stale test in tenant-scope behavior after stricter explicit-site write enforcement

### Known blocker

- CRATER: local client/server build blocked because TypeScript compiler is unavailable in the current installed environment

## High-Risk Verification Areas

1. HUB
   - user create/edit/delete
   - app access toggles
   - site assignment
   - app launch

2. SCORVA
   - ATO
   - POAM
   - Controls
   - Tasks
   - Trackers
   - site switching

3. Sentinel
   - Facility
   - Personnel
   - Activities
   - Documents
   - DD254
   - Media
   - Inspections
   - site-scoped writes

4. Nexus
   - bootstrap load
   - admin save/delete flows
   - rollup rendering

5. LAVA
   - auth and access
   - SAAR / system / hardware writes

6. CRATER
   - buildability first
   - then auth and system CRUD

## Recommended Sequence

1. Repair Sentinel stale verification
2. Restore CRATER build verification
3. Run focused smoke verification on HUB, SCORVA, Sentinel, Nexus
4. Run LAVA verification
5. Decide whether suite-wide deployment is safe

## Source Files

Use the role files in `.agents/roles/` plus the ticket and handoffs in `docs/` to assign this work to Claude or another model.
