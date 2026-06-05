CREATE TABLE IF NOT EXISTS "mash_dd254_register" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "contract_number" TEXT,
  "program_name" TEXT,
  "customer" TEXT,
  "prime_or_sub" TEXT,
  "dd254_status" TEXT NOT NULL DEFAULT 'Draft',
  "revision" TEXT,
  "effective_date" TEXT,
  "expiration_date" TEXT,
  "review_due_date" TEXT,
  "classification_level" TEXT,
  "has_sci" BOOLEAN NOT NULL DEFAULT false,
  "has_sap" BOOLEAN NOT NULL DEFAULT false,
  "cui_required" BOOLEAN NOT NULL DEFAULT false,
  "government_activity" TEXT,
  "owner" TEXT,
  "security_requirements_summary" TEXT,
  "document_link" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "updated_by" TEXT,

  CONSTRAINT "mash_dd254_register_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mash_dd254_register_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "mash_dd254_register_site_id_idx"
  ON "mash_dd254_register"("site_id");
