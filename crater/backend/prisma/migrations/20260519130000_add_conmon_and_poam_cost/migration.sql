-- CreateEnum (idempotent: skip if already exists from db push)
DO $$ BEGIN
  CREATE TYPE "ConMonEventType" AS ENUM ('CONTROL_ASSESSMENT', 'POAM_REVIEW', 'ATO_RENEWAL', 'SECURITY_REVIEW', 'SYSTEM_SCAN', 'TRAINING', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConMonEventStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConMonRecurrence" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: add cost column to poam_items (idempotent)
ALTER TABLE "poam_items" ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION;

-- CreateTable: conmon_events (idempotent)
CREATE TABLE IF NOT EXISTS "conmon_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" "ConMonEventType" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ConMonEventStatus" NOT NULL DEFAULT 'PENDING',
    "recurrence" "ConMonRecurrence" NOT NULL DEFAULT 'NONE',
    "controlId" TEXT,
    "poamItemId" TEXT,
    "assignedTo" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conmon_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conmon_events_projectId_idx" ON "conmon_events"("projectId");
CREATE INDEX IF NOT EXISTS "conmon_events_dueDate_idx" ON "conmon_events"("dueDate");
CREATE INDEX IF NOT EXISTS "conmon_events_status_idx" ON "conmon_events"("status");
CREATE INDEX IF NOT EXISTS "conmon_events_eventType_idx" ON "conmon_events"("eventType");

-- AddForeignKey (drop first to be idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conmon_events_projectId_fkey'
  ) THEN
    ALTER TABLE "conmon_events"
      ADD CONSTRAINT "conmon_events_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
