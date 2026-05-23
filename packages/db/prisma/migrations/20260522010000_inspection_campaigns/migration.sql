-- CreateTable: inspection_campaigns
CREATE TABLE "inspection_campaigns" (
    "id"               TEXT         NOT NULL,
    "site_id"          TEXT         NOT NULL,
    "template_id"      TEXT,
    "template_name"    TEXT         NOT NULL,
    "template_version" TEXT,
    "name"             TEXT         NOT NULL,
    "status"           TEXT         NOT NULL DEFAULT 'Draft',
    "start_date"       TIMESTAMP(3),
    "target_date"      TIMESTAMP(3),
    "completed_at"     TIMESTAMP(3),
    "owner_name"       TEXT,
    "notes"            TEXT,
    "created_by"       TEXT         NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: inspection_campaign_sections
CREATE TABLE "inspection_campaign_sections" (
    "id"                  TEXT         NOT NULL,
    "campaign_id"         TEXT         NOT NULL,
    "template_section_id" TEXT,
    "section_code"        TEXT,
    "title"               TEXT         NOT NULL,
    "sort_order"          INTEGER      NOT NULL DEFAULT 0,
    "status"              TEXT         NOT NULL DEFAULT 'Not Started',
    "completed_at"        TIMESTAMP(3),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_campaign_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: inspection_campaign_items
CREATE TABLE "inspection_campaign_items" (
    "id"                  TEXT         NOT NULL,
    "campaign_id"         TEXT         NOT NULL,
    "section_id"          TEXT         NOT NULL,
    "template_item_id"    TEXT,
    "item_code"           TEXT,
    "nispom_ref"          TEXT,
    "question_text"       TEXT         NOT NULL,
    "applicability_note"  TEXT,
    "risk_category"       TEXT,
    "evidence_required"   BOOLEAN      NOT NULL DEFAULT false,
    "control_ref"         TEXT,
    "sort_order"          INTEGER      NOT NULL DEFAULT 0,
    "status"              TEXT         NOT NULL DEFAULT 'Not Started',
    "work_notes"          TEXT,
    "updated_by"          TEXT,
    "status_updated_at"   TIMESTAMP(3),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_campaign_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_campaigns_site_id_idx" ON "inspection_campaigns"("site_id");
CREATE INDEX "inspection_campaign_sections_campaign_id_idx" ON "inspection_campaign_sections"("campaign_id");
CREATE INDEX "inspection_campaign_items_campaign_id_idx" ON "inspection_campaign_items"("campaign_id");
CREATE INDEX "inspection_campaign_items_section_id_idx" ON "inspection_campaign_items"("section_id");

-- AddForeignKey
ALTER TABLE "inspection_campaigns"
    ADD CONSTRAINT "inspection_campaigns_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspection_campaign_sections"
    ADD CONSTRAINT "inspection_campaign_sections_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "inspection_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspection_campaign_items"
    ADD CONSTRAINT "inspection_campaign_items_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "inspection_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspection_campaign_items"
    ADD CONSTRAINT "inspection_campaign_items_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "inspection_campaign_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
