# HUB Control Plane Target Architecture

**Status:** Target state draft — 2026-06-04  
**Primary goal:** Make HUB the identity and access control plane for the platform, similar in purpose to Okta or Microsoft Entra's app launcher, while keeping each operational app independent.

---

## 1. Core Principle

The platform should follow one rule:

**HUB owns identity and entitlements. Each app owns its own data and behavior.**

That means:

- `HUB` decides who the user is
- `HUB` decides which apps the user can launch
- `HUB` decides which sites the user belongs to
- `HUB` decides what admin authority the user has inside HUB
- `SCORVA`, `MASH`, `LAVA`, `NEXUS`, and `CRATER` decide what the user can do once inside that app

---

## 2. Responsibility Boundaries

### HUB owns

- Authentication entry point
- SSO token/session issuance
- User directory
- App entitlements
- Site memberships
- HUB-only admin authority
- Access request workflow
- Identity audit logs
- App launch surface / portal

### HUB does not own

- MASH workspace behavior
- SCORVA RMF / cyber workflow rules
- LAVA operational workflow rules
- NEXUS PM / executive dashboard logic
- Per-record authorization inside downstream apps

### Downstream apps own

Each app owns:

- its own routes
- its own operational tables
- its own query filtering
- its own write rules
- its own app-specific permissions

---

## 3. Canonical Identity Model

The platform should standardize on this identity shape:

```ts
type HubIdentity = {
  id: string
  username: string
  email: string
  name: string
  hubRole: 'Hub Admin' | 'Hub User' | 'Hub Viewer'
  jobRole: string | null
  primarySiteId: string | null
  siteIds: string[]
  allowedApps: string[]
  status: 'Active' | 'Inactive'
}
```

### Meaning of each field

| Field | Purpose |
|---|---|
| `hubRole` | HUB admin authority only |
| `jobRole` | Functional/organizational role; descriptive and app-hint only |
| `primarySiteId` | Default site context |
| `siteIds` | Tenant scope across the platform |
| `allowedApps` | App launcher / app-entry permission |
| `status` | Whether the account is active |

---

## 4. Access Model

The platform should treat access as the combination of three independent controls:

### A. App entry

`allowedApps`

Controls whether the user can enter an app at all.

Examples:

- If `allowedApps` includes `mash`, the user can launch MASH
- If `allowedApps` does not include `scorva`, the user cannot enter SCORVA

### B. Data scope

`siteIds`

Controls which site data the user can read or modify inside an app.

Examples:

- `siteIds = ['MTSI-HVL']` means the user should only see Huntsville data
- `siteIds = ['MTSI-ALX', 'MTSI-HVL']` means the user may access both

### C. HUB authority

`hubRole`

Controls what the user can do in HUB itself.

Examples:

- `Hub Admin` can manage users, sites, and app entitlements
- `Hub User` and `Hub Viewer` cannot perform HUB admin actions

### D. Job role

`jobRole`

This should not be the primary access engine.

It may still be used for:

- display and organization
- app-specific workflow hints
- transitional compatibility where an app still relies on it

But the target state is:

**`allowedApps + siteIds + app-local rules` determine access.**

---

## 5. SSO Contract

HUB should issue one standard claim shape to all apps.

```json
{
  "sub": "user-id",
  "username": "jdoe",
  "email": "jdoe@example.com",
  "name": "Jane Doe",
  "hubRole": "Hub Admin",
  "jobRole": "Information Security",
  "primarySiteId": "MTSI-ALX",
  "siteIds": ["MTSI-ALX"],
  "allowedApps": ["hub", "scorva", "mash"],
  "status": "Active"
}
```

### Downstream app contract

Every app must:

1. validate the HUB-issued token/session
2. verify that its app id exists in `allowedApps`
3. enforce data scope using `siteIds`
4. apply app-specific authorization rules locally

HUB should not decide fine-grained downstream behavior after login.

### Transitional contract (implemented now)

The current HUB implementation should emit both the new canonical fields and legacy compatibility aliases during transition.

Canonical fields:

- `authVersion`
- `hubRole`
- `jobRole`
- `primarySiteId`
- `siteIds`
- `allowedApps`

Legacy compatibility aliases:

- `role` → legacy app-facing platform role alias where needed
- `securityRole` → mirrors `jobRole`
- `siteId` / `site` → mirror `primarySiteId`

Target state:

- downstream apps should migrate to the canonical fields
- legacy aliases should be removed only after all apps are verified

---

## 6. Database Ownership Model

### Central shared layer

Owned by HUB:

- `users`
- `sites`
- `access_requests`
- `hub_sso_tokens`
- identity/admin audit tables
- optional shared reference tables

### App-owned operational layer

Owned by each app:

- `scorva_*`
- `mash_*`
- `lava_*`
- `nexus_*` for program-management/admin content
- `crater_*`

### Rule

Use central tables to answer:

- who the user is
- what apps they can open
- which sites they belong to

Use app tables to answer:

- what data exists
- what workflows exist
- what the user can do with operational records

---

## 7. Site Isolation Model

Operational apps should enforce site isolation locally.

### Standard rule

Every site-owned operational record must carry `site_id`.

### Standard enforcement

- reads must filter by `siteIds`
- writes must validate target `siteId`
- single-record fetches must confirm that `record.siteId` is in the user's allowed site set

### Exception

`Hub Admin` may have all-site visibility, but only where the app explicitly allows cross-site views.

---

## 8. HUB Admin UX Target

HUB should feel like an identity console, not an operational app.

### Recommended sections

- Users
- Sites
- Access Requests
- App Entitlements
- Audit Log

### Recommended user-management structure

- Site tree
- within each site: `Hub Admin`, `Hub User`, `Hub Viewer`
- click a role group to see users
- click a user to edit:
  - `jobRole`
  - `siteIds`
  - `primarySiteId`
  - `allowedApps`
  - `status`

### Recommended user fields

- Name
- Username
- Email
- HUB Role
- Job Role
- Primary Site
- Site Memberships
- Allowed Apps
- Status

---

## 9. Transitional Compatibility Rules

The current codebase still has some app-specific behavior tied to `securityRole` / `jobRole`.

Short-term, keep compatibility where needed:

- `MASH` may still map `jobRole` to workspace behavior
- `NEXUS` may still use `jobRole === 'Program Manager'` for some admin paths
- `LAVA` may still treat some job roles as operator roles
- legacy SCORVA translation may still derive old values from the functional role

Target state:

- keep `jobRole` available in claims
- reduce its use in access decisions
- move each app toward explicit app-local authorization

---

## 10. Phased Simplification Plan

### Phase 1 — Freeze HUB scope

Goal: make HUB a pure identity/control plane.

- Standardize field names: `hubRole`, `jobRole`, `primarySiteId`, `siteIds`, `allowedApps`
- Remove duplicated identity concepts where possible
- Keep explicit app entitlements in HUB as the source of truth

### Phase 2 — Make app entry explicit everywhere

Goal: all apps trust `allowedApps` for entry.

- Every app must reject users not entitled to that app
- Access requests must grant app access explicitly
- Remove any remaining "role implies app access" behavior from HUB over time

### Phase 3 — Standardize token contract

Goal: every app consumes the same claim shape.

- Replace legacy role aliases where possible
- Ensure local sessions preserve `hubRole`, `jobRole`, `siteIds`, `allowedApps`

### Phase 4 — Keep site scope inside each app

Goal: HUB stops acting like a downstream authorization engine.

- SCORVA enforces SCORVA rules
- MASH enforces MASH rules
- LAVA enforces LAVA rules
- NEXUS enforces NEXUS rules

### Phase 5 — Reporting isolation for NEXUS

Goal: NEXUS consumes stable reporting surfaces rather than raw app internals.

- build reporting views/materialized views
- keep source app ownership clean
- avoid HUB-mediated operational joins

---

## 11. Practical Recommendation

Do **not** collapse everything into one giant app.

Do:

- keep HUB as the front door and control plane
- keep each app independently deployable
- keep each app responsible for its own operational rules
- keep app entitlements explicit
- keep site scope explicit

That gets the platform much closer to "our own Okta" without forcing HUB to become a monolith.

---

## 12. Immediate Next Steps

1. Finish simplifying HUB identity terminology around `jobRole`
2. Make `allowedApps` the only app-entry source of truth
3. Audit each app for any remaining "role implies app entry" behavior
4. Standardize the HUB SSO claim shape
5. Create an app-by-app responsibility matrix and migration checklist
