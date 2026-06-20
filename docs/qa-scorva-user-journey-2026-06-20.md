## SCORVA QA User-Journey Sweep

Date: 2026-06-20
Agent role: `qa-user-journey`
Method: static code inspection of SCORVA client/server flows, route inventory, mutation paths, and scope/auth behavior
Coverage note: this pass validates module wiring, role/scope behavior, and likely UX failures from code. It is not a browser-automation click replay of every field in every modal.

### What was reviewed

- Auth/session bootstrap and site-selection state
- App shell and sidebar behavior
- Authorization modules: ATO, Controls, POAM
- Monitoring modules: ConMon, Trackers, Security Events, Checklist Library / Self-Inspection
- Administration modules: Sites, Users, Program View shell exposure

### Findings

#### 1. High: SCORVA can mutate shared user identity records using its own local role model

- Persona: HUB admin / SCORVA admin
- Impacted module: `Administration > Users`
- Files:
  - [scorva-v1/server/routes/users.js](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/server/routes/users.js:8)
  - [scorva-v1/client/src/pages/Users.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client/src/pages/Users.jsx:16)
- Repro:
  1. Open SCORVA user administration.
  2. Create or edit a user from inside SCORVA.
  3. Set role values like `Viewer`, `Analyst`, `Operator`, `Site Admin`, or `Corporate Admin`.
- Observed:
  - SCORVA writes directly to the shared `db.user` table.
  - The SCORVA form exposes a local SCORVA role taxonomy and local password management.
  - The server persists those local role values back into the shared user record.
- Expected:
  - SCORVA should not be a second source of truth for shared identity, role naming, or password management if HUB is the canonical identity plane.
  - If SCORVA needs app-local permissions, they should be app-scoped fields, not overwriting shared identity role semantics.
- Why this matters:
  - This can directly recreate the cross-app role drift you have already been trying to eliminate.
  - A user edited in SCORVA can end up with shared DB values that no longer match HUB’s intended model.

#### 2. High: Site selector and admin affordances are still gated by legacy `Corporate Admin` role checks instead of effective scope

- Persona: any user with broad site scope from HUB, including `canSeeAllSites` users whose `role` is not exactly `Corporate Admin`
- Impacted modules:
  - SCORVA sidebar site selector
  - Sites admin page
  - Program View visibility
  - Inspection campaign creation/admin controls
- Files:
  - [scorva-v1/client/src/components/layout/Sidebar.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client/src/components/layout/Sidebar.jsx:65)
  - [scorva-v1/client/src/context/AuthContext.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client/src/context/AuthContext.jsx:61)
  - [scorva-v1/client/src/pages/Sites.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client/src/pages/Sites.jsx:24)
  - [scorva-v1/client/src/pages/apps/AdminApp.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client/src/pages/apps/AdminApp.jsx:24)
  - [scorva-v1/client/src/pages/ChecklistLibrary.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client/src/pages/ChecklistLibrary.jsx:321)
- Repro:
  1. Sign in as a user whose effective scope comes from HUB claims such as `canSeeAllSites` or equivalent broad access.
  2. Open SCORVA.
  3. Check whether the site selector, Sites management, Program View, and campaign-create affordances appear.
- Observed:
  - `AuthContext` recognizes broad scope using `canSeeAllSites`, `hubRole === 'Hub Admin'`, or `role === 'Corporate Admin'`.
  - `Sidebar` still renders the site selector only when `user?.role === 'Corporate Admin'`.
  - `SitesPage` and `AdminApp` also gate UI using `user?.role === 'Corporate Admin'`.
  - `ChecklistLibrary` uses `user?.role === 'Corporate Admin'` and `user?.role === 'Site Admin'` rather than the canonical effective-scope model.
- Expected:
  - These UI permissions should be derived from canonical scope and capability claims, not legacy role strings.
- Why this matters:
  - This is the exact class of defect that makes one admin see controls while another equally-authorized admin does not.
  - It also causes “missing site selector” regressions.

#### 3. Medium: Inspection checklist items refetch immediately on status change, which can make the active question appear to jump or disappear

- Persona: inspector working through a checklist
- Impacted module: `Monitoring > Self-Inspection / Checklist Library`
- File:
  - [scorva-v1/client/src/pages/ChecklistLibrary.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client/src/pages/ChecklistLibrary.jsx:717)
- Repro:
  1. Open a campaign detail.
  2. Filter by section and/or status.
  3. Change an item from `Not Started` to `In Progress` or `Complete`.
- Observed:
  - The page queries campaign items using section, search, and status filters.
  - Every item save invalidates both the item list query and the campaign summary query immediately.
  - If the saved item no longer matches the active filter, or the backend ordering changes, the visible item list can jump.
- Expected:
  - A user should get a stable in-place interaction, or at minimum an explicit “item moved out of current filter” cue.
- Why this matters:
  - This matches the user complaint that selecting a checklist result makes the question seem to vanish randomly.
  - It is a UX trust problem even if the save is technically succeeding.

#### 4. Medium: Inspection campaign create/admin paths still use role-name assumptions that can diverge from real authorization

- Persona: authorized inspection manager
- Impacted module: `Monitoring > Self-Inspection / Checklist Library`
- File:
  - [scorva-v1/client/src/pages/ChecklistLibrary.jsx](/mnt/c/Users/macab/OneDrive/Apps/security-app-factory/scorva-v1/client/src/pages/ChecklistLibrary.jsx:397)
- Repro:
  1. Sign in as a user who should be allowed to manage inspections based on effective scope/claims.
  2. Open Campaigns.
  3. Verify whether `New Campaign` and editable campaign status controls appear.
- Observed:
  - Campaign create and admin-edit behavior is gated by `user?.role === 'Corporate Admin' || user?.role === 'Site Admin'`.
  - Site requirement logic inside the create modal also keys off `user?.role === 'Corporate Admin'`.
- Expected:
  - Inspection-management capability should come from a canonical permission/capability model, not whichever local legacy string happens to be in `user.role`.
- Why this matters:
  - This can create inconsistent inspection authority between users who are operationally equivalent.

### Positive observations

- Site-aware query keys are present in the major SCORVA modules reviewed:
  - `ATO`
  - `Controls`
  - `ConMon`
  - `Trackers`
  - `Security Events`
  - `Checklist Library`
- Explicit site-scoped create guards are already in use in the high-risk create flows.
- The control-catalog/site-implementation split is moving toward a more supportable multi-tenant model.

### Recommended QA disposition

- Result: `needs-fixes-before-full-release-signoff`
- Primary release blockers:
  - Shared-user mutation from SCORVA
  - Legacy-role gating of site/admin capabilities
- Secondary UX bug:
  - Inspection checklist item jumpiness after save
