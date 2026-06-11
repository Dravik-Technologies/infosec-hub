-- CreateEnum
CREATE TYPE "PPSMProtocol" AS ENUM ('TCP', 'UDP', 'ICMP');

-- CreateEnum
CREATE TYPE "PPSMDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'BOTH');

-- CreateEnum
CREATE TYPE "PPSMApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'RETIRED');

-- CreateTable
CREATE TABLE "ppsm_entries" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "port" TEXT NOT NULL,
    "protocol" "PPSMProtocol" NOT NULL,
    "direction" "PPSMDirection" NOT NULL,
    "serviceApplication" TEXT NOT NULL,
    "justification" TEXT,
    "approvalStatus" "PPSMApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ppsm_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ppsm_entries_projectId_idx" ON "ppsm_entries"("projectId");

-- CreateIndex
CREATE INDEX "ppsm_entries_protocol_idx" ON "ppsm_entries"("protocol");

-- CreateIndex
CREATE INDEX "ppsm_entries_direction_idx" ON "ppsm_entries"("direction");

-- CreateIndex
CREATE INDEX "ppsm_entries_approvalStatus_idx" ON "ppsm_entries"("approvalStatus");

-- AddForeignKey
ALTER TABLE "ppsm_entries" ADD CONSTRAINT "ppsm_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
