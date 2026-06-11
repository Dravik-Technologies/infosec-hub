-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('HARDWARE', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "InventoryApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'RETIRED');

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "modelVersion" TEXT,
    "location" TEXT,
    "classification" TEXT,
    "approvalStatus" "InventoryApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_items_projectId_idx" ON "inventory_items"("projectId");

-- CreateIndex
CREATE INDEX "inventory_items_itemType_idx" ON "inventory_items"("itemType");

-- CreateIndex
CREATE INDEX "inventory_items_approvalStatus_idx" ON "inventory_items"("approvalStatus");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
