-- Phase B: Site-Tenantization — siteId indexes for all site-owned SCORVA models
--
-- These indexes are additive and non-destructive.
-- IMPORTANT for Codex / production deployment:
--   Run each CREATE INDEX with CONCURRENTLY to avoid table locks on live traffic:
--     CREATE INDEX CONCURRENTLY IF NOT EXISTS "..." ON "..."("site_id");
--   Prisma does not emit CONCURRENTLY in managed migrations; Codex should run
--   these statements manually outside the migration transaction if the tables
--   have significant row counts.

-- Controls
CREATE INDEX IF NOT EXISTS "controls_site_id_idx" ON "controls"("site_id");

-- Tasks
CREATE INDEX IF NOT EXISTS "tasks_site_id_idx" ON "tasks"("site_id");

-- POA&Ms
CREATE INDEX IF NOT EXISTS "poams_site_id_idx" ON "poams"("site_id");

-- ATO Packages
CREATE INDEX IF NOT EXISTS "ato_packages_site_id_idx" ON "ato_packages"("site_id");

-- Workstations (nullable — index still helps filtered reads)
CREATE INDEX IF NOT EXISTS "workstations_site_id_idx" ON "workstations"("site_id");

-- YubiKeys (nullable)
CREATE INDEX IF NOT EXISTS "yubi_keys_site_id_idx" ON "yubi_keys"("site_id");

-- Licenses (nullable)
CREATE INDEX IF NOT EXISTS "licenses_site_id_idx" ON "licenses"("site_id");

-- Agreements
CREATE INDEX IF NOT EXISTS "agreements_site_id_idx" ON "agreements"("site_id");

-- Audit Logs
CREATE INDEX IF NOT EXISTS "audit_logs_site_id_idx" ON "audit_logs"("site_id");

-- Notifications (nullable)
CREATE INDEX IF NOT EXISTS "notifications_site_id_idx" ON "notifications"("site_id");

-- Security Events
CREATE INDEX IF NOT EXISTS "security_events_site_id_idx" ON "security_events"("site_id");

-- Trackers (nullable)
CREATE INDEX IF NOT EXISTS "trackers_site_id_idx" ON "trackers"("site_id");
