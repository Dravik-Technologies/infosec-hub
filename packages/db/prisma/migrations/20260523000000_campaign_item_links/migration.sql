-- Add task and POAM linkage columns to inspection_campaign_items
ALTER TABLE "inspection_campaign_items"
    ADD COLUMN "task_id" TEXT,
    ADD COLUMN "poam_id" TEXT;
