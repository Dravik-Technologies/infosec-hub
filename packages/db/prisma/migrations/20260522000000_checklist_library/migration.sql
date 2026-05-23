CREATE TABLE "checklist_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "source" TEXT,
  "version" TEXT,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_sections" (
  "id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "section_code" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checklist_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_items" (
  "id" TEXT NOT NULL,
  "section_id" TEXT NOT NULL,
  "item_code" TEXT,
  "nispom_ref" TEXT,
  "question_text" TEXT NOT NULL,
  "applicability_note" TEXT,
  "risk_category" TEXT,
  "evidence_required" BOOLEAN NOT NULL DEFAULT false,
  "control_ref" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checklist_sections_template_id_idx" ON "checklist_sections"("template_id");
CREATE INDEX "checklist_items_section_id_idx" ON "checklist_items"("section_id");

ALTER TABLE "checklist_sections"
  ADD CONSTRAINT "checklist_sections_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_items"
  ADD CONSTRAINT "checklist_items_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "checklist_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
