ALTER TABLE "con_mon"
  ADD COLUMN "assignee" TEXT,
  ADD COLUMN "review_outcome" TEXT;

ALTER TABLE "trackers"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "frequency" TEXT,
  ADD COLUMN "owner" TEXT,
  ADD COLUMN "next_due" TEXT,
  ADD COLUMN "last_completed" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN "control_id" TEXT;
