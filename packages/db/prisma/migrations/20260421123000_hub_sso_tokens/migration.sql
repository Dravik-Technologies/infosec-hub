-- CreateTable
CREATE TABLE "hub_sso_tokens" (
  "token_hash" TEXT NOT NULL,
  "user_data" JSONB NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hub_sso_tokens_pkey" PRIMARY KEY ("token_hash")
);

-- CreateIndex
CREATE INDEX "hub_sso_tokens_expires_at_idx" ON "hub_sso_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "hub_sso_tokens_consumed_at_idx" ON "hub_sso_tokens"("consumed_at");
