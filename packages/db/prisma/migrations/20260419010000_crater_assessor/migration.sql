-- CRATER assessor validation fields
-- Adds validated_at, validated_by to project_controls for assessor sign-off workflow

ALTER TABLE "project_controls"
  ADD COLUMN IF NOT EXISTS "validated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validated_by" TEXT;
