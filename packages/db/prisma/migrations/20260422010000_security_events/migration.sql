-- Add SCORVA security events module storage
CREATE TABLE IF NOT EXISTS "security_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Other',
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "source" TEXT,
    "asset_id" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New',
    "site_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_events_site_id_idx" ON "security_events"("site_id");
CREATE INDEX IF NOT EXISTS "security_events_source_created_at_idx" ON "security_events"("source", "created_at");
CREATE INDEX IF NOT EXISTS "security_events_status_idx" ON "security_events"("status");
CREATE INDEX IF NOT EXISTS "security_events_severity_idx" ON "security_events"("severity");

ALTER TABLE "security_events"
    ADD CONSTRAINT "security_events_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
