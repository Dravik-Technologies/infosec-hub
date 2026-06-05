CREATE TABLE IF NOT EXISTS "nexus_snapshots" (
  "id" TEXT NOT NULL,
  "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "site_id" TEXT,
  "cyber_score" INTEGER,
  "security_score" INTEGER,
  "program_score" INTEGER,
  "open_poams" INTEGER,
  "authorized_atos" INTEGER,
  "expired_atos" INTEGER,
  "open_findings" INTEGER,
  "nominal_facilities" INTEGER,
  "overdue_training" INTEGER,
  "pending_saars" INTEGER,
  "meta" JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT "nexus_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nexus_snapshots_snapshot_at_idx"
  ON "nexus_snapshots"("snapshot_at");

CREATE INDEX IF NOT EXISTS "nexus_snapshots_site_id_snapshot_at_idx"
  ON "nexus_snapshots"("site_id", "snapshot_at");
