ALTER TABLE "poams"
  ADD COLUMN "risk_workflow_state" TEXT NOT NULL DEFAULT 'Draft',
  ADD COLUMN "risk_submitted_at" TIMESTAMP(3),
  ADD COLUMN "risk_submitted_by" TEXT,
  ADD COLUMN "risk_reviewed_at" TIMESTAMP(3),
  ADD COLUMN "risk_reviewed_by" TEXT,
  ADD COLUMN "risk_review_notes" TEXT;
