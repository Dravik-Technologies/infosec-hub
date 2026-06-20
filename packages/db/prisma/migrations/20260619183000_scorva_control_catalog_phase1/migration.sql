-- Phase 1 additive schema for SCORVA multi-tenant control catalog support.
-- This migration is intentionally non-destructive: it does not modify or remove
-- the legacy "controls" table used by the live SCORVA controls workspace.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ControlOwnershipMode') THEN
    CREATE TYPE "ControlOwnershipMode" AS ENUM ('enterprise', 'site', 'hybrid');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ControlOwnerType') THEN
    CREATE TYPE "ControlOwnerType" AS ENUM ('enterprise', 'site');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "control_model" "ControlOwnershipMode" NOT NULL DEFAULT 'hybrid',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

ALTER TABLE "sites"
  ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sites_tenant_id_fkey'
  ) THEN
    ALTER TABLE "sites"
      ADD CONSTRAINT "sites_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sites_tenant_id_idx" ON "sites"("tenant_id");

CREATE TABLE IF NOT EXISTS "control_catalog" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT,
  "control_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "family" TEXT,
  "baseline" TEXT,
  "description" TEXT,
  "source" TEXT,
  "implementation_default" TEXT,
  "owner_type" "ControlOwnerType" NOT NULL DEFAULT 'enterprise',
  "owner_site_id" TEXT,
  "is_template" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "control_catalog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'control_catalog_tenant_id_fkey'
  ) THEN
    ALTER TABLE "control_catalog"
      ADD CONSTRAINT "control_catalog_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'control_catalog_owner_site_id_fkey'
  ) THEN
    ALTER TABLE "control_catalog"
      ADD CONSTRAINT "control_catalog_owner_site_id_fkey"
      FOREIGN KEY ("owner_site_id") REFERENCES "sites"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "control_catalog_tenant_id_idx" ON "control_catalog"("tenant_id");
CREATE INDEX IF NOT EXISTS "control_catalog_owner_type_owner_site_id_idx" ON "control_catalog"("owner_type", "owner_site_id");
CREATE UNIQUE INDEX IF NOT EXISTS "control_catalog_tenant_id_owner_type_owner_site_id_control_key_key"
  ON "control_catalog"("tenant_id", "owner_type", "owner_site_id", "control_key");

CREATE TABLE IF NOT EXISTS "site_control_implementations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT,
  "site_id" TEXT NOT NULL,
  "control_catalog_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Not Implemented',
  "last_review" TEXT,
  "findings" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "implementation_guidance" TEXT,
  "conmon_status" TEXT,
  "conmon_group" TEXT,
  "conmon_frequency" TEXT,
  "assigned_to" TEXT,
  "evidence_summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_control_implementations_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_control_implementations_tenant_id_fkey'
  ) THEN
    ALTER TABLE "site_control_implementations"
      ADD CONSTRAINT "site_control_implementations_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_control_implementations_site_id_fkey'
  ) THEN
    ALTER TABLE "site_control_implementations"
      ADD CONSTRAINT "site_control_implementations_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_control_implementations_control_catalog_id_fkey'
  ) THEN
    ALTER TABLE "site_control_implementations"
      ADD CONSTRAINT "site_control_implementations_control_catalog_id_fkey"
      FOREIGN KEY ("control_catalog_id") REFERENCES "control_catalog"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "site_control_implementations_tenant_id_idx" ON "site_control_implementations"("tenant_id");
CREATE INDEX IF NOT EXISTS "site_control_implementations_site_id_idx" ON "site_control_implementations"("site_id");
CREATE INDEX IF NOT EXISTS "site_control_implementations_control_catalog_id_idx" ON "site_control_implementations"("control_catalog_id");
CREATE UNIQUE INDEX IF NOT EXISTS "site_control_implementations_site_id_control_catalog_id_key"
  ON "site_control_implementations"("site_id", "control_catalog_id");

CREATE TABLE IF NOT EXISTS "site_control_findings" (
  "id" TEXT NOT NULL,
  "site_control_id" TEXT NOT NULL,
  "severity" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Open',
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_control_findings_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_control_findings_site_control_id_fkey'
  ) THEN
    ALTER TABLE "site_control_findings"
      ADD CONSTRAINT "site_control_findings_site_control_id_fkey"
      FOREIGN KEY ("site_control_id") REFERENCES "site_control_implementations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "site_control_findings_site_control_id_idx" ON "site_control_findings"("site_control_id");
CREATE INDEX IF NOT EXISTS "site_control_findings_status_idx" ON "site_control_findings"("status");

CREATE TABLE IF NOT EXISTS "site_control_evidence" (
  "id" TEXT NOT NULL,
  "site_control_id" TEXT NOT NULL,
  "artifact_type" TEXT,
  "file_name" TEXT,
  "url" TEXT,
  "notes" TEXT,
  "uploaded_by" TEXT,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_control_evidence_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_control_evidence_site_control_id_fkey'
  ) THEN
    ALTER TABLE "site_control_evidence"
      ADD CONSTRAINT "site_control_evidence_site_control_id_fkey"
      FOREIGN KEY ("site_control_id") REFERENCES "site_control_implementations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "site_control_evidence_site_control_id_idx" ON "site_control_evidence"("site_control_id");
