-- CRATER RMF Automation Engine — PostgreSQL tables
-- Adds ProjectSystem, ProjectControl, StandardLibrary
-- Safe: only creates new tables, does not modify existing ones

-- ─── project_systems ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "project_systems" (
    "id"                     TEXT NOT NULL,
    "external_id"            TEXT,
    "name"                   TEXT NOT NULL,
    "abbreviation"           TEXT NOT NULL,
    "system_type"            TEXT NOT NULL DEFAULT 'Major Application',
    "organization"           TEXT NOT NULL,
    "description"            TEXT,
    "classification_marking" TEXT,
    "system_owner"           TEXT,
    "isso"                   TEXT,
    "issm"                   TEXT,
    "confidentiality"        TEXT NOT NULL DEFAULT 'Low',
    "integrity"              TEXT NOT NULL DEFAULT 'Low',
    "availability"           TEXT NOT NULL DEFAULT 'Low',
    "baseline"               TEXT NOT NULL DEFAULT 'LOW',
    "ato_status"             TEXT NOT NULL DEFAULT 'Pre-ATO',
    "site_id"                TEXT NOT NULL,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_systems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_systems_external_id_key" ON "project_systems"("external_id");

ALTER TABLE "project_systems"
    ADD CONSTRAINT "project_systems_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── project_controls ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "project_controls" (
    "id"                       TEXT NOT NULL,
    "project_system_id"        TEXT NOT NULL,
    "control_id"               TEXT NOT NULL,
    "control_title"            TEXT NOT NULL,
    "family"                   TEXT NOT NULL,
    "status"                   TEXT NOT NULL DEFAULT 'Not Implemented',
    "implementation_statement" TEXT,
    "standard_text"            TEXT,
    "auto_filled"              BOOLEAN NOT NULL DEFAULT false,
    "tailoring_required"       BOOLEAN NOT NULL DEFAULT false,
    "implementation_origin"    TEXT NOT NULL DEFAULT 'System Specific',
    "evidence_links"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "assessor_notes"           TEXT,
    "site_id"                  TEXT NOT NULL,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_controls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_controls_project_system_id_control_id_key"
    ON "project_controls"("project_system_id", "control_id");

ALTER TABLE "project_controls"
    ADD CONSTRAINT "project_controls_project_system_id_fkey"
    FOREIGN KEY ("project_system_id") REFERENCES "project_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── standard_library ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "standard_library" (
    "id"                       TEXT NOT NULL,
    "control_id"               TEXT NOT NULL,
    "control_title"            TEXT NOT NULL,
    "family"                   TEXT NOT NULL,
    "implementation_statement" TEXT NOT NULL,
    "implementation_origin"    TEXT NOT NULL DEFAULT 'System Specific',
    "tailoring_required"       BOOLEAN NOT NULL DEFAULT false,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standard_library_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "standard_library_control_id_key" ON "standard_library"("control_id");
