CREATE TABLE IF NOT EXISTS "lava_saars" (
  "id" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "middle_initial" TEXT,
  "rank_grade" TEXT,
  "organization" TEXT NOT NULL,
  "office_symbol" TEXT,
  "phone" TEXT,
  "email" TEXT NOT NULL,
  "supervisor_name" TEXT,
  "supervisor_phone" TEXT,
  "supervisor_email" TEXT,
  "system_name" TEXT NOT NULL,
  "system_owner" TEXT,
  "classification" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  "purpose_of_access" TEXT,
  "access_type" TEXT NOT NULL DEFAULT 'standard',
  "privileged_justification" TEXT,
  "privileged_access_type" TEXT,
  "annual_training_date" TIMESTAMP(3),
  "derivative_training_date" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "rejection_reason" TEXT,
  "reviewer_comment" TEXT,
  "yubi_key_serial" TEXT,
  "token_type" TEXT,
  "provisioning_notes" TEXT,
  "agreement_signed" BOOLEAN NOT NULL DEFAULT false,
  "agreement_signed_at" TIMESTAMP(3),
  "submitted_by" TEXT,
  "reviewed_by" TEXT,
  "provisioned_by" TEXT,
  "site_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lava_saars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "lava_system_requests" (
  "id" TEXT NOT NULL,
  "system_name" TEXT NOT NULL,
  "system_owner" TEXT NOT NULL,
  "owner_email" TEXT NOT NULL,
  "owner_phone" TEXT,
  "classification" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  "purpose" TEXT NOT NULL,
  "network_type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewed_by" TEXT,
  "review_notes" TEXT,
  "site_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lava_system_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "lava_assets" (
  "id" TEXT NOT NULL,
  "system_request_id" TEXT NOT NULL,
  "asset_tag" TEXT,
  "serial_number" TEXT,
  "make" TEXT,
  "model" TEXT,
  "asset_type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Assigned',
  "classification" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  "assigned_user" TEXT,
  "location" TEXT,
  "notes" TEXT,
  "site_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lava_assets_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'lava_assets_system_request_id_fkey'
  ) THEN
    ALTER TABLE "lava_assets"
      ADD CONSTRAINT "lava_assets_system_request_id_fkey"
      FOREIGN KEY ("system_request_id") REFERENCES "lava_system_requests"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "lava_saars"
  ADD COLUMN IF NOT EXISTS "reviewer_comment" TEXT,
  ADD COLUMN IF NOT EXISTS "provisioning_notes" TEXT;

ALTER TABLE "lava_system_requests"
  ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT,
  ADD COLUMN IF NOT EXISTS "review_notes" TEXT;

ALTER TABLE "lava_assets"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Assigned';

CREATE TABLE IF NOT EXISTS "lava_audit_logs" (
  "id" TEXT NOT NULL,
  "actor" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "details" TEXT,
  "site_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lava_audit_logs_pkey" PRIMARY KEY ("id")
);
