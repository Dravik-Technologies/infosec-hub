# SCORVA Control Catalog Multi-Tenant Plan

Date: 2026-06-19
Scope: SCORVA control library, ConMon, ATO, POAM

## Goal

Support both of these customer operating models without rewriting SCORVA later:

1. Enterprise baseline model
Corporate security publishes one master control baseline and each site tracks its own implementation and compliance status.

2. Site-owned model
Each site uploads and owns its own controls independently.

3. Hybrid model
Corporate publishes a baseline, and sites may add local-only controls on top of it.

This must work for MTSI and also for future non-MTSI customers.

## Current Problem

Today SCORVA stores controls as site-owned rows:

- `Control.id` is the primary key
- `Control.siteId` is required

That creates a design conflict:

- the row is acting as both the control definition and the site implementation
- a second site cannot cleanly own its own `AC-2` row if the same control ID already exists elsewhere
- importing NIST as a corporate admin raises the wrong question: "what site does this control belong to?"

The root issue is that the system is missing a distinction between:

- the control definition
- the site's implementation of that control

## Recommended Product Model

Separate the system into:

1. `ControlCatalog`
The reusable control definition.

2. `SiteControlImplementation`
The site-specific implementation and compliance record.

This lets one tenant use a central enterprise baseline while another tenant lets each site manage its own controls independently.

## Tenant-Level Configuration

Add a per-tenant control ownership mode:

- `enterprise`
- `site`
- `hybrid`

Behavior:

- `enterprise`
  Only enterprise-owned control definitions are used. Sites only manage implementation records.

- `site`
  Sites upload and own their own control definitions. No enterprise baseline required.

- `hybrid`
  Enterprise baseline definitions are available, and sites may add local-only control definitions.

## Proposed Prisma Models

Note:
The current shared schema does not yet have a first-class `Tenant` model. This plan assumes one will be introduced for productization. If tenantization is deferred, `tenantId` can temporarily be omitted and the same model can operate as a single-tenant deployment.

### New enum: ControlOwnershipMode

```prisma
enum ControlOwnershipMode {
  enterprise
  site
  hybrid
}
```

### New enum: ControlOwnerType

```prisma
enum ControlOwnerType {
  enterprise
  site
}
```

### Proposed Tenant model

```prisma
model Tenant {
  id               String               @id @default(cuid())
  name             String
  slug             String               @unique
  controlModel     ControlOwnershipMode @default(hybrid) @map("control_model")
  createdAt        DateTime             @default(now()) @map("created_at")
  updatedAt        DateTime             @updatedAt @map("updated_at")

  sites            Site[]
  controlCatalog   ControlCatalog[]
  siteControls     SiteControlImplementation[]

  @@map("tenants")
}
```

### Site updates

```prisma
model Site {
  id        String   @id
  tenantId  String?  @map("tenant_id")
  tenant    Tenant?  @relation(fields: [tenantId], references: [id])
  label     String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users               User[]
  tasks               Task[]
  poams               Poam[]
  atoPackages         AtoPackage[]
  conmons             ConMon[]
  workstations        Workstation[]
  yubiKeys            YubiKey[]
  licenses            License[]
  agreements          Agreement[]
  notifications       Notification[]
  trackers            Tracker[]
  projectSystems      ProjectSystem[]
  securityEvents      SecurityEvent[]
  evidenceArtifacts   EvidenceArtifact[]
  inspectionCampaigns InspectionCampaign[]
  mashFacilities      MashFacilitySecurity[]
  mashPersonnel       MashPersonnelSecurity[]
  mashActivities      MashActivitiesSecurity[]
  mashDocuments       MashDocumentControl[]
  mashDd254Registers  MashDd254Register[]
  mashMedia           MashMediaControl[]
  mashSelfInspections MashSelfInspectionOp[]
  mashFindings        MashSecurityFinding[]
  siteControlCatalogs ControlCatalog[]            @relation("SiteOwnedControlCatalog")
  siteControls        SiteControlImplementation[]

  @@index([tenantId])
  @@map("sites")
}
```

### New ControlCatalog model

This is the reusable control definition.

```prisma
model ControlCatalog {
  id                         String          @id @default(cuid())
  tenantId                   String?         @map("tenant_id")
  tenant                     Tenant?         @relation(fields: [tenantId], references: [id])
  controlKey                 String          @map("control_key")
  title                      String
  family                     String?
  baseline                   String?
  description                String?
  source                     String?         // e.g. NIST-800-53r5, JSIG, Custom
  implementationDefault      String?         @map("implementation_default")
  ownerType                  ControlOwnerType @default(enterprise) @map("owner_type")
  ownerSiteId                String?         @map("owner_site_id")
  ownerSite                  Site?           @relation("SiteOwnedControlCatalog", fields: [ownerSiteId], references: [id])
  isTemplate                 Boolean         @default(true) @map("is_template")
  isActive                   Boolean         @default(true) @map("is_active")
  version                    String?
  createdAt                  DateTime        @default(now()) @map("created_at")
  updatedAt                  DateTime        @updatedAt @map("updated_at")

  siteImplementations        SiteControlImplementation[]

  @@index([tenantId])
  @@index([ownerType, ownerSiteId])
  @@unique([tenantId, ownerType, ownerSiteId, controlKey])
  @@map("control_catalog")
}
```

### New SiteControlImplementation model

This is the actual site-level implementation state.

```prisma
model SiteControlImplementation {
  id                         String   @id @default(cuid())
  tenantId                   String?  @map("tenant_id")
  tenant                     Tenant?  @relation(fields: [tenantId], references: [id])
  siteId                     String   @map("site_id")
  site                       Site     @relation(fields: [siteId], references: [id])
  controlCatalogId           String   @map("control_catalog_id")
  controlCatalog             ControlCatalog @relation(fields: [controlCatalogId], references: [id])

  status                     String   @default("Not Implemented")
  lastReview                 String?  @map("last_review")
  findings                   Int      @default(0)
  notes                      String?
  implementationGuidance     String?  @map("implementation_guidance")
  conmonStatus               String?  @map("conmon_status")
  conmonGroup                String?  @map("conmon_group")
  conmonFrequency            String?  @map("conmon_frequency")
  assignedTo                 String?  @map("assigned_to")
  evidenceSummary            String?  @map("evidence_summary")
  createdAt                  DateTime @default(now()) @map("created_at")
  updatedAt                  DateTime @updatedAt @map("updated_at")

  findingsRecords            SiteControlFinding[]
  evidenceArtifacts          SiteControlEvidence[]

  @@index([tenantId])
  @@index([siteId])
  @@index([controlCatalogId])
  @@unique([siteId, controlCatalogId])
  @@map("site_control_implementations")
}
```

### New SiteControlFinding model

```prisma
model SiteControlFinding {
  id                    String   @id @default(cuid())
  siteControlId         String   @map("site_control_id")
  siteControl           SiteControlImplementation @relation(fields: [siteControlId], references: [id], onDelete: Cascade)
  severity              String?
  title                 String
  description           String?
  status                String   @default("Open")
  openedAt              DateTime @default(now()) @map("opened_at")
  closedAt              DateTime? @map("closed_at")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@index([siteControlId])
  @@index([status])
  @@map("site_control_findings")
}
```

### New SiteControlEvidence model

```prisma
model SiteControlEvidence {
  id                    String   @id @default(cuid())
  siteControlId         String   @map("site_control_id")
  siteControl           SiteControlImplementation @relation(fields: [siteControlId], references: [id], onDelete: Cascade)
  artifactType          String?  @map("artifact_type")
  fileName              String?  @map("file_name")
  url                   String?
  notes                 String?
  uploadedBy            String?  @map("uploaded_by")
  uploadedAt            DateTime @default(now()) @map("uploaded_at")

  @@index([siteControlId])
  @@map("site_control_evidence")
}
```

## How Existing SCORVA Models Map

### Current `Control`

Current `Control` mixes:

- control definition fields
  - `id`
  - `title`
  - `family`
  - `baseline`
  - `description`

- site implementation fields
  - `status`
  - `lastReview`
  - `findings`
  - `notes`
  - `implementationGuidance`
  - `siteId`
  - `conmonStatus`
  - `conmonGroup`
  - `conmonFrequency`

### Future split

Move these to `ControlCatalog`:

- `id` becomes `controlKey`
- `title`
- `family`
- `baseline`
- `description`

Move these to `SiteControlImplementation`:

- `status`
- `lastReview`
- `findings`
- `notes`
- `implementationGuidance`
- `conmonStatus`
- `conmonGroup`
- `conmonFrequency`
- `siteId`

## Recommended API Surface

### Catalog routes

- `GET /api/control-catalog`
- `POST /api/control-catalog/import`
- `POST /api/control-catalog`
- `PATCH /api/control-catalog/:id`
- `DELETE /api/control-catalog/:id`

Behavior by mode:

- `enterprise`
  only tenant admins may manage enterprise catalog definitions

- `site`
  site-scoped users may manage site-owned catalog definitions for their site

- `hybrid`
  both are allowed according to role

### Site implementation routes

- `GET /api/site-controls`
- `POST /api/site-controls/sync-from-catalog`
- `PATCH /api/site-controls/:id`
- `POST /api/site-controls/:id/findings`
- `PATCH /api/site-controls/:id/findings/:findingId`
- `POST /api/site-controls/:id/evidence`

## UI Model

### Controls page

Split into two surfaces:

1. `Control Definitions`
- enterprise library
- site library
- import source

2. `Site Implementations`
- current status
- ConMon tracking
- evidence
- findings

### Default behavior by mode

- `enterprise`
  show enterprise catalog and site implementation workspace

- `site`
  show site-owned catalog and site implementation workspace

- `hybrid`
  show enterprise baseline, local site-only controls, and implementation workspace

## Migration Strategy

### Phase 1: additive schema

Add:

- `Tenant`
- `Site.tenantId`
- `ControlCatalog`
- `SiteControlImplementation`
- `SiteControlFinding`
- `SiteControlEvidence`

Do not remove current `Control` yet.

### Phase 2: backfill catalog rows

For every distinct current control definition:

- group by `id`, `title`, `family`, `baseline`, `description`
- create `ControlCatalog` rows

Initial ownership rule:

- if current customer is MTSI and wants shared baseline:
  backfill as `ownerType = enterprise`

- if current tenant is site-owned:
  backfill as `ownerType = site`
  with `ownerSiteId = current siteId`

### Phase 3: backfill site implementations

For each current `Control` row:

- find matching `ControlCatalog`
- create `SiteControlImplementation`

### Phase 4: dual-read UI

Update SCORVA UI and API to read:

- definitions from `ControlCatalog`
- compliance state from `SiteControlImplementation`

Keep current `Control` as fallback during transition.

### Phase 5: switch writes

All new writes go to:

- `ControlCatalog`
- `SiteControlImplementation`

Stop writing to current `Control`.

### Phase 6: retire legacy table

Once verified:

- freeze legacy `Control`
- archive or remove after migration confidence window

## Product Recommendation

For future customers:

- default new tenants to `hybrid`

Reason:

- MTSI can use enterprise baseline + site implementation
- smaller customers can keep things site-local
- customers can evolve without data model rewrites

## Immediate SCORVA Decision

Do not refactor the live SCORVA controls page directly into this model in one pass.

Instead:

1. finish the current controls-page customer fixes
2. add tenant control mode settings
3. introduce additive schema
4. migrate controls in phases

This avoids breaking ConMon, POAM linkage, reports, and dashboards all at once.

