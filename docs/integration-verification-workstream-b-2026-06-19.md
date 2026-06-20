# Integration Verification Report

## Title

Workstream B High-Risk Smoke Coverage

## Date

2026-06-19

## Agent

`integration-verifier`

## Scope

- HUB admin flows
- Nexus admin flows
- LAVA operator flows

## Verification Method

This pass used:

- route/client flow mapping
- build and syntax verification
- permission gate inspection
- mutation/refresh path inspection

This is a meaningful engineering smoke pass, but it is not a live browser-click certification of every action.

## Pass / Fail Matrix

| App | Area | Result | Notes |
| --- | --- | --- | --- |
| HUB | Admin create/edit/delete wiring | Pass | client and server paths are present and coherent |
| HUB | Admin launch/access request wiring | Pass | portal fetches apps and launch token flow is wired |
| HUB | Automated regression coverage | Fail | no meaningful automated admin-flow coverage found |
| Nexus | Admin write route wiring | Pass | portfolio, KPI, section CRUD, settings, snapshot routes are present |
| Nexus | Client admin save/delete wiring | Pass | client uses API helpers and shows explicit error states |
| Nexus | Automated regression coverage | Fail | no automated admin-flow coverage found |
| LAVA | SAAR lifecycle route wiring | Pass | approve/reject/provision/lifecycle routes exist and enforce site scope |
| LAVA | Hardware CRUD route wiring | Pass | upload/list/update/delete flows exist and enforce site scope |
| LAVA | Automated regression coverage | Fail | no automated operator-flow coverage found |

## Verified Healthy Paths

### HUB

Confirmed:

- user update path exists and updates local client state after save
  - [hub/client/src/pages/AccessAdmin.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/client/src/pages/AccessAdmin.jsx:110)
- user delete path exists and removes row from local client state immediately
  - [hub/client/src/pages/AccessAdmin.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/client/src/pages/AccessAdmin.jsx:133)
- user create path exists and prepends the created user locally
  - [hub/client/src/pages/AccessAdmin.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/client/src/pages/AccessAdmin.jsx:152)
- server update route validates and revokes tokens when permissions materially change
  - [hub/server/routes/admin.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/server/routes/admin.js:312)
- server delete route blocks self-delete and is `corpAdminOnly`
  - [hub/server/routes/admin.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/server/routes/admin.js:431)
- portal launch path is wired through `/api/apps` and SSO launch URL generation
  - [hub/server/index.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/server/index.js:59)
  - [hub/client/src/context/AuthContext.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/client/src/context/AuthContext.jsx:40)

### Nexus

Confirmed:

- admin permission gate exists and blocks unauthorized writers
  - [nexus/server.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/nexus/server.js:515)
- full admin write surface exists for:
  - portfolio
  - KPI upsert/delete
  - section add/update/delete
  - settings
  - snapshot
  - [nexus/server.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/nexus/server.js:1165)
- admin client save paths explicitly surface network/API failure instead of silently succeeding
  - [nexus/client/src/pages/AdminPage.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/nexus/client/src/pages/AdminPage.jsx:151)
- logout endpoint exists client and server side
  - [nexus/client/src/App.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/nexus/client/src/App.jsx:135)
  - [nexus/server.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/nexus/server.js:1014)

### LAVA

Confirmed:

- SAAR list/detail/status/provision/lifecycle routes exist and are site-scoped
  - [lava/server/routes/saar.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/saar.js:129)
  - [lava/server/routes/saar.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/saar.js:163)
  - [lava/server/routes/saar.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/saar.js:205)
  - [lava/server/routes/saar.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/saar.js:256)
- hardware upload/list/update/delete paths exist and enforce system/asset site checks
  - [lava/server/routes/hardware.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/hardware.js:107)
  - [lava/server/routes/hardware.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/hardware.js:172)
  - [lava/server/routes/hardware.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/hardware.js:207)
  - [lava/server/routes/hardware.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/hardware.js:257)
- client Vulcan command actions refresh after mutation
  - [lava/client/src/pages/VulcanCommand.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/client/src/pages/VulcanCommand.jsx:120)

## Findings

### Finding 1

- Severity: Medium
- Title: HUB admin flows are wired correctly but still lack automated or browser-proven regression coverage
- Status: Open
- Why it matters:
  - user management is high-risk
  - trust currently depends on code inspection plus build health
- Likely files:
  - [hub/client/src/pages/AccessAdmin.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/client/src/pages/AccessAdmin.jsx:110)
  - [hub/server/routes/admin.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/hub/server/routes/admin.js:312)

### Finding 2

- Severity: Medium
- Title: Nexus admin console is structurally wired, but high-impact write paths remain under-verified from a real-user standpoint
- Status: Open
- Why it matters:
  - admin console writes directly shape executive-visible data
  - failures here would look like silent dashboard drift
- Likely files:
  - [nexus/server.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/nexus/server.js:1165)
  - [nexus/client/src/pages/AdminPage.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/nexus/client/src/pages/AdminPage.jsx:151)

### Finding 3

- Severity: Medium
- Title: LAVA operator flows appear tenant-safe in code, but still need browser-level validation for full lifecycle confidence
- Status: Open
- Why it matters:
  - provisioning and lifecycle actions are operationally sensitive
  - code-level confidence is not the same as click-through proof
- Likely files:
  - [lava/server/routes/saar.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/saar.js:163)
  - [lava/server/routes/hardware.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/server/routes/hardware.js:107)
  - [lava/client/src/pages/VulcanCommand.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/lava/client/src/pages/VulcanCommand.jsx:120)

## Build / Syntax Results

- HUB build: Pass
- Nexus client build: Pass
- LAVA server syntax: Pass

## Remaining Risk

The current status for Workstream B is:

- code-smoke verified
- not fully browser-smoke verified

That means:

- the routes exist,
- the client calls exist,
- the permission gates exist,
- but we still have not proven every critical action with live seeded data and click-through behavior.

## Recommendation

Do not treat Workstream B as fully closed yet.

Recommended next slice:

1. live browser smoke for HUB admin create/edit/delete and app access reflection
2. live browser smoke for Nexus admin create/edit/delete across each section
3. live browser smoke for LAVA SAAR approve/reject/provision/lifecycle and hardware update/delete

## Suggested Next Owner

- `integration-verifier` again if continuing manual smoke work
- or `backend-engineer` / `frontend-engineer` only if a real defect is observed during live smoke
