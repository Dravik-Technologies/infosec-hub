# Default Delivery Workflow

## Small Bug

1. `qa-user-journey`
2. `product-manager`
3. `app-engineer`
4. `integration-verifier`
5. `release-security-engineer`
6. `azure-release-engineer`

## DB / Tenant / Auth Change

1. `qa-user-journey`
2. `product-manager`
3. `backend-engineer`
4. `db-tenancy-engineer`
5. `integration-verifier`
6. `release-security-engineer`
7. `azure-release-engineer`

## UI Refresh / Visual Polish

1. `qa-user-journey`
2. `product-manager`
3. `frontend-engineer`
4. `integration-verifier`
5. `release-security-engineer`
6. `azure-release-engineer`

## Multi-App Rollout

1. `qa-user-journey`
2. `product-manager`
3. `app-engineer` or `frontend/backend-engineer`
4. `db-tenancy-engineer` if shared schema changes
5. `integration-verifier`
6. `qa-user-journey` regression check
7. `release-security-engineer`
8. `azure-release-engineer`

## Handoff Discipline

At each step:

1. Fill `templates/handoff-template.md`
2. Keep the brief app-specific
3. Record actual files touched
4. Record what was verified vs assumed
