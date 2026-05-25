ALTER TABLE "lava_saars"
  ADD COLUMN IF NOT EXISTS "access_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revalidation_due_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revoked_by" TEXT,
  ADD COLUMN IF NOT EXISTS "revocation_reason" TEXT;
