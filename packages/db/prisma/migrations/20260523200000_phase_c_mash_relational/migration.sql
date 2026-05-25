-- Phase C: MASH relational operational domains
-- Replaces JSON blob storage (MashCollection) for 7 site-owned MASH domains.
--
-- IMPORTANT for Codex / production deployment:
--   These CREATE INDEX statements should be run with CONCURRENTLY on production
--   to avoid table locks. Prisma does not emit CONCURRENTLY in managed migrations;
--   run them manually outside the migration transaction if tables have significant rows.
--
-- Assumptions (Codex must verify before executing):
--   1. siteId values in MashCollection JSON records match Site.id values in the sites table.
--      Seed data uses "site-001" / "site-002"; production must have real site IDs.
--   2. Run the backfill script AFTER this migration: security-dashboard/scripts/backfillMashRelational.js

CREATE TABLE "mash_facility_security" (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "site_id"             TEXT NOT NULL REFERENCES "sites"("id"),
  "name"                TEXT NOT NULL,
  "location"            TEXT,
  "facility_type"       TEXT,
  "fcl_level"           TEXT,
  "fcl_status"          TEXT,
  "fcl_expires"         TEXT,
  "fcl_package"         TEXT,
  "compliance_score"    INTEGER,
  "status"              TEXT NOT NULL DEFAULT 'Active',
  "notes"               TEXT,
  "kmp"                 JSONB DEFAULT '[]',
  "accreditation"       JSONB DEFAULT '{}',
  "open_storage"        JSONB DEFAULT '{}',
  "alarm_ids"           JSONB DEFAULT '{}',
  "access_control"      JSONB DEFAULT '{}',
  "dcsa_inspection"     JSONB DEFAULT '{}',
  "internal_inspection" JSONB DEFAULT '{}',
  "construction"        JSONB DEFAULT '{}',
  "waivers"             JSONB DEFAULT '[]',
  "vulnerabilities"     JSONB DEFAULT '[]',
  "open_issues"         JSONB DEFAULT '[]',
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL,
  "created_by"          TEXT,
  "updated_by"          TEXT
);

CREATE INDEX IF NOT EXISTS "mash_facility_security_site_id_idx" ON "mash_facility_security"("site_id");

CREATE TABLE "mash_personnel_security" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "site_id"               TEXT NOT NULL REFERENCES "sites"("id"),
  "username"              TEXT,
  "name"                  TEXT NOT NULL,
  "position"              TEXT,
  "org"                   TEXT,
  "clearance_level"       TEXT,
  "clearance_status"      TEXT,
  "clearance_grant_date"  TEXT,
  "clearance_prd"         TEXT,
  "indoc_date"            TEXT,
  "debrief_date"          TEXT,
  "cv_status"             TEXT,
  "nbis_eapp_status"      TEXT,
  "notes"                 TEXT,
  "caveat_access"         JSONB DEFAULT '[]',
  "formal_access"         JSONB DEFAULT '[]',
  "training"              JSONB DEFAULT '{}',
  "visit_access_requests" JSONB DEFAULT '[]',
  "adverse_info"          JSONB DEFAULT '[]',
  "foreign_contacts"      JSONB DEFAULT '[]',
  "foreign_travel"        JSONB DEFAULT '[]',
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL,
  "created_by"            TEXT,
  "updated_by"            TEXT
);

CREATE INDEX IF NOT EXISTS "mash_personnel_security_site_id_idx" ON "mash_personnel_security"("site_id");

CREATE TABLE "mash_activities_security" (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "site_id"             TEXT NOT NULL REFERENCES "sites"("id"),
  "category"            TEXT,
  "title"               TEXT NOT NULL,
  "date"                TEXT,
  "time"                TEXT,
  "location"            TEXT,
  "classification"      TEXT,
  "status"              TEXT NOT NULL DEFAULT 'Planned',
  "owner"               TEXT,
  "visitor_count"       INTEGER,
  "clearance_verified"  BOOLEAN,
  "briefing_required"   BOOLEAN,
  "notes"               TEXT,
  "participants"        JSONB DEFAULT '[]',
  "evidence_links"      JSONB DEFAULT '[]',
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL,
  "created_by"          TEXT,
  "updated_by"          TEXT
);

CREATE INDEX IF NOT EXISTS "mash_activities_security_site_id_idx" ON "mash_activities_security"("site_id");

CREATE TABLE "mash_document_control" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "site_id"               TEXT NOT NULL REFERENCES "sites"("id"),
  "doc_number"            TEXT,
  "title"                 TEXT NOT NULL,
  "classification"        TEXT,
  "program"               TEXT,
  "category"              TEXT,
  "copy_count"            INTEGER,
  "accountable"           BOOLEAN NOT NULL DEFAULT FALSE,
  "custodian"             TEXT,
  "current_location"      TEXT,
  "version"               TEXT,
  "date"                  TEXT,
  "last_inventory"        TEXT,
  "next_inventory"        TEXT,
  "reproduction_controls" TEXT,
  "status"                TEXT NOT NULL DEFAULT 'Active',
  "notes"                 TEXT,
  "receipts"              JSONB DEFAULT '[]',
  "dispatches"            JSONB DEFAULT '[]',
  "destructions"          JSONB DEFAULT '[]',
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL,
  "created_by"            TEXT,
  "updated_by"            TEXT
);

CREATE INDEX IF NOT EXISTS "mash_document_control_site_id_idx" ON "mash_document_control"("site_id");

CREATE TABLE "mash_media_control" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "site_id"        TEXT NOT NULL REFERENCES "sites"("id"),
  "media_id"       TEXT,
  "type"           TEXT,
  "label"          TEXT,
  "classification" TEXT,
  "program"        TEXT,
  "capacity_gb"    INTEGER,
  "make"           TEXT,
  "model"          TEXT,
  "serial_number"  TEXT,
  "status"         TEXT NOT NULL DEFAULT 'Unassigned',
  "assigned_to"    TEXT,
  "assigned_date"  TEXT,
  "return_due"     TEXT,
  "system"         TEXT,
  "last_scan"      TEXT,
  "last_approval"  TEXT,
  "approved_by"    TEXT,
  "notes"          TEXT,
  "flags"          JSONB DEFAULT '[]',
  "history"        JSONB DEFAULT '[]',
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL,
  "created_by"     TEXT,
  "updated_by"     TEXT
);

CREATE INDEX IF NOT EXISTS "mash_media_control_site_id_idx" ON "mash_media_control"("site_id");

CREATE TABLE "mash_self_inspection_ops" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "site_id"        TEXT NOT NULL REFERENCES "sites"("id"),
  "title"          TEXT NOT NULL,
  "year"           INTEGER,
  "status"         TEXT NOT NULL DEFAULT 'Planned',
  "start_date"     TEXT,
  "due_date"       TEXT,
  "completed_date" TEXT,
  "inspector"      TEXT,
  "standard"       TEXT,
  "progress"       INTEGER DEFAULT 0,
  "kma_briefed"    BOOLEAN DEFAULT FALSE,
  "report_package" TEXT,
  "notes"          TEXT,
  "scope"          JSONB DEFAULT '[]',
  "findings"       JSONB DEFAULT '[]',
  "evidence"       JSONB DEFAULT '[]',
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL,
  "created_by"     TEXT,
  "updated_by"     TEXT
);

CREATE INDEX IF NOT EXISTS "mash_self_inspection_ops_site_id_idx" ON "mash_self_inspection_ops"("site_id");

CREATE TABLE "mash_security_findings" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "site_id"        TEXT NOT NULL REFERENCES "sites"("id"),
  "finding_number" TEXT,
  "area"           TEXT,
  "requirement"    TEXT,
  "finding"        TEXT,
  "severity"       TEXT NOT NULL DEFAULT 'Medium',
  "status"         TEXT NOT NULL DEFAULT 'Open',
  "owner"          TEXT,
  "open_date"      TEXT,
  "due_date"       TEXT,
  "closed_date"    TEXT,
  "corrective"     TEXT,
  "notes"          TEXT,
  "inspection_id"  TEXT,
  "evidence"       JSONB DEFAULT '[]',
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL,
  "created_by"     TEXT,
  "updated_by"     TEXT
);

CREATE INDEX IF NOT EXISTS "mash_security_findings_site_id_idx" ON "mash_security_findings"("site_id");
