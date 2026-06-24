# Azure Migration

This repo is now prepared to run on Azure as a multi-container platform backed by:

- Azure Container Registry for images
- Azure Container Apps for service hosting
- Azure Database for PostgreSQL Flexible Server for shared persistence

The target deployment shape is:

- `hub` -> external ingress
- `scorva` -> external ingress
- `lava` -> external ingress
- `mash` -> external ingress
- `data-fabric` -> external ingress
- `crater-ui` -> external ingress
- `crater-api` -> internal ingress

## Important Changes Already Made

- `MASH` now supports PostgreSQL-backed storage instead of container-local JSON persistence.
- `data-fabric` now supports PostgreSQL-backed document storage and DB-backed sessions.
- Cross-service auth paths were updated so Azure services can use HTTPS FQDNs through `HUB_URL` and `SCORVA_URL`.
- Shared Prisma schema now includes the storage tables needed by `MASH` and `data-fabric`.

## Azure Resources To Create

Create these resources first:

1. Resource group
2. Azure Container Registry
3. Azure Container Apps environment
4. Azure Database for PostgreSQL Flexible Server
5. PostgreSQL database named for this platform, for example `securityapp`

Suggested CLI starting point:

```powershell
az group create --name saf-rg --location eastus

az acr create `
  --resource-group saf-rg `
  --name safregistry `
  --sku Basic

az monitor log-analytics workspace create `
  --resource-group saf-rg `
  --workspace-name saf-logs

$workspaceId = az monitor log-analytics workspace show `
  --resource-group saf-rg `
  --workspace-name saf-logs `
  --query customerId -o tsv

$workspaceKey = az monitor log-analytics workspace get-shared-keys `
  --resource-group saf-rg `
  --workspace-name saf-logs `
  --query primarySharedKey -o tsv

az containerapp env create `
  --name saf-env `
  --resource-group saf-rg `
  --location eastus `
  --logs-workspace-id $workspaceId `
  --logs-workspace-key $workspaceKey
```

For PostgreSQL Flexible Server, use Microsoft Learn guidance for:

- private access / VNet integration for production
- public access only for short-lived pilot environments

Official docs:

- Container Apps ingress: https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview
- Container Apps env vars: https://learn.microsoft.com/en-us/azure/container-apps/environment-variables
- Container Apps secrets: https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets
- PostgreSQL private access: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/quickstart-create-connect-server-vnet/
- PostgreSQL private networking concepts: https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private
- ACR quickstart: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-get-started-azure-cli

## Migration Order

Run the migration in this order:

1. Create Azure foundation resources.
2. Build and push all container images to ACR.
3. Run Prisma migrations against Azure Database for PostgreSQL.
4. Deploy `hub`.
5. Deploy `scorva`.
6. Update `hub` with the final `SCORVA_URL`.
7. Deploy `crater-api` and `crater-ui`.
8. Deploy `lava`, `mash`, and `data-fabric`.
9. Validate auth, SSO, and database writes.

## Scripts Included

### Build and Push Images

```powershell
.\infra\azure\build-and-push.ps1 `
  -ResourceGroup saf-rg `
  -AcrName safregistry `
  -ImageTag 2026-04-20
```

This script builds and pushes:

- `hub`
- `scorva`
- `lava`
- `mash`
- `data-fabric`
- `crater-api`
- `crater-ui`

### Run Prisma Migrations

```powershell
.\infra\azure\migrate-postgres.ps1 `
  -DatabaseUrl "<pull-from-key-vault-or-env>"
```

This applies all Prisma migrations, including the new `MASH` and `data-fabric` storage tables.

### Deploy Container Apps

```powershell
.\infra\azure\deploy-container-apps.ps1 `
  -ResourceGroup saf-rg `
  -ContainerAppsEnvironment saf-env `
  -AcrName safregistry `
  -PostgresServer mypgserver `
  -PostgresDatabase securityapp `
  -PostgresAdminUser adminuser `
  -PostgresAdminPassword "<password>" `
  -HubSessionSecret "<secret>" `
  -ScorvaSessionSecret "<secret>" `
  -ScorvaJwtSecret "<secret>" `
  -CraterJwtSecret "<secret>" `
  -LavaSessionSecret "<secret>" `
  -MashJwtSecret "<secret>" `
  -ImageTag 2026-04-20 `
  -AppPrefix saf
```

This script:

- creates or updates the Container Apps
- wires app secrets into Container Apps secrets
- sets the correct `HUB_URL` and `SCORVA_URL`
- deploys `crater-api` with internal ingress

## App-Level Environment Mapping

### hub

- `DATABASE_URL`
- `SESSION_SECRET`
- `SSO_TOKEN_TTL`
- `SCORVA_URL`

### scorva

- `DATABASE_URL`
- `SESSION_SECRET`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `HUB_URL`

### lava

- `DATABASE_URL`
- `SESSION_SECRET`
- `HUB_URL`

### mash

- `DATABASE_URL`
- `JWT_SECRET`
- `HUB_URL`

### data-fabric

- `DATABASE_URL`
- `HUB_URL`

### crater-api

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `HUB_URL`

## Validation Checklist

- `hub` login succeeds against PostgreSQL users
- `scorva` login works from the hub
- `mash` can perform SSO and persist edits to PostgreSQL
- `data-fabric` admin login works and document edits persist to PostgreSQL
- `lava` can authenticate against `hub`
- `crater-api` can reach PostgreSQL and `hub`
- `crater-ui` loads and can call `crater-api`

## Current Limitations

- This repo is prepared for Azure deployment, but nothing in this repo can provision your Azure subscription credentials for you.
- The included deployment script uses ACR admin credentials for simplicity. After cutover, move image pulls to managed identity.
- `crater-api` still has a separate AI feature decision to make if you want Azure-native model hosting rather than the current local-model-oriented path.
