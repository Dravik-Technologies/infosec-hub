-- AlterTable InspectionCampaign
ALTER TABLE "inspection_campaigns"
ADD COLUMN IF NOT EXISTS "inspection_type" TEXT,
ADD COLUMN IF NOT EXISTS "facility_area" TEXT,
ADD COLUMN IF NOT EXISTS "standard" TEXT,
ADD COLUMN IF NOT EXISTS "overall_rating" TEXT,
ADD COLUMN IF NOT EXISTS "lead_inspector" TEXT;

CREATE INDEX IF NOT EXISTS "inspection_campaigns_status_idx" ON "inspection_campaigns"("status");

-- AlterTable InspectionCampaignSection
ALTER TABLE "inspection_campaign_sections"
ADD COLUMN IF NOT EXISTS "score_percent" INTEGER,
ADD COLUMN IF NOT EXISTS "summary" TEXT;

-- AlterTable InspectionCampaignItem
ALTER TABLE "inspection_campaign_items"
ADD COLUMN IF NOT EXISTS "requirement_ref" TEXT,
ADD COLUMN IF NOT EXISTS "result" TEXT,
ADD COLUMN IF NOT EXISTS "severity" TEXT,
ADD COLUMN IF NOT EXISTS "evidence_notes" TEXT,
ADD COLUMN IF NOT EXISTS "inspector_comment" TEXT;

CREATE INDEX IF NOT EXISTS "inspection_campaign_items_result_idx" ON "inspection_campaign_items"("result");

-- CreateTable InspectionFinding
CREATE TABLE IF NOT EXISTS "inspection_findings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "finding_number" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirement_ref" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "responsible_org" TEXT,
    "responsible_user" TEXT,
    "due_date" TIMESTAMP(3),
    "closed_date" TIMESTAMP(3),
    "root_cause" TEXT,
    "evidence" JSONB DEFAULT '[]',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inspection_findings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "inspection_campaigns" ("id") ON DELETE CASCADE,
    CONSTRAINT "inspection_findings_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inspection_campaign_items" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "inspection_findings_campaign_id_idx" ON "inspection_findings"("campaign_id");
CREATE INDEX IF NOT EXISTS "inspection_findings_item_id_idx" ON "inspection_findings"("item_id");
CREATE INDEX IF NOT EXISTS "inspection_findings_status_idx" ON "inspection_findings"("status");
CREATE INDEX IF NOT EXISTS "inspection_findings_severity_idx" ON "inspection_findings"("severity");

-- CreateTable InspectionCorrectiveAction
CREATE TABLE IF NOT EXISTS "inspection_corrective_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "finding_id" TEXT NOT NULL,
    "action_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "assigned_to" TEXT,
    "assigned_org" TEXT,
    "target_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "verification_by" TEXT,
    "verification_notes" TEXT,
    "closure_evidence" JSONB DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inspection_corrective_actions_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "inspection_findings" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "inspection_corrective_actions_finding_id_idx" ON "inspection_corrective_actions"("finding_id");
CREATE INDEX IF NOT EXISTS "inspection_corrective_actions_status_idx" ON "inspection_corrective_actions"("status");
CREATE INDEX IF NOT EXISTS "inspection_corrective_actions_target_date_idx" ON "inspection_corrective_actions"("target_date");
