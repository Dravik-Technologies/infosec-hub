-- AddColumn token_epoch to users table for JWT revocation support
ALTER TABLE "users" ADD COLUMN "token_epoch" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex on token_epoch for efficient lookups
CREATE INDEX "users_token_epoch_idx" ON "users"("token_epoch");
