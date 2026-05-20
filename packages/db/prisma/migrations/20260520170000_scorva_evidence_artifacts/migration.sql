CREATE TABLE "evidence_artifacts" (
    "id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "artifact_type" TEXT,
    "notes" TEXT,
    "uploaded_by" TEXT,
    "data" BYTEA NOT NULL,
    "site_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evidence_artifacts_resource_type_resource_id_idx" ON "evidence_artifacts"("resource_type", "resource_id");
CREATE INDEX "evidence_artifacts_site_id_idx" ON "evidence_artifacts"("site_id");

ALTER TABLE "evidence_artifacts"
ADD CONSTRAINT "evidence_artifacts_site_id_fkey"
FOREIGN KEY ("site_id") REFERENCES "sites"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
