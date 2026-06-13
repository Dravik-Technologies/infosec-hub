ALTER TABLE "mash_activities_security"
  ADD COLUMN IF NOT EXISTS "due_date" TEXT,
  ADD COLUMN IF NOT EXISTS "program" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT;
