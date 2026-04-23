-- Add POAM risk decision fields used by SCORVA
ALTER TABLE "poams"
  ADD COLUMN IF NOT EXISTS "risk_decision" TEXT,
  ADD COLUMN IF NOT EXISTS "risk_rationale" TEXT;
