ALTER TABLE "mash_media_control"
  ADD COLUMN IF NOT EXISTS "current_location" TEXT,
  ADD COLUMN IF NOT EXISTS "destruction_scheduled" TEXT,
  ADD COLUMN IF NOT EXISTS "destruction_method" TEXT;
