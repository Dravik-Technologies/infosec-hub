-- PostgreSQL-backed content/session storage for MASH and data-fabric.
-- These tables preserve existing JSON document shapes while removing the
-- dependency on container-local files and in-memory sessions.

CREATE TABLE "mash_collections" (
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mash_collections_pkey" PRIMARY KEY ("name")
);

CREATE TABLE "data_fabric_documents" (
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_fabric_documents_pkey" PRIMARY KEY ("name")
);

CREATE TABLE "data_fabric_sessions" (
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_fabric_sessions_pkey" PRIMARY KEY ("token")
);

CREATE INDEX "data_fabric_sessions_expires_at_idx" ON "data_fabric_sessions"("expires_at");
