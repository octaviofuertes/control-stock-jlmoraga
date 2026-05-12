-- CreateEnum
CREATE TYPE "SpareMovementAction" AS ENUM ('ADD', 'REMOVE');

-- CreateTable
CREATE TABLE "SpareItemMovement" (
    "id" TEXT NOT NULL,
    "spareItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "SpareMovementAction" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "resultingStock" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpareItemMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpareItemMovement_spareItemId_createdAt_idx" ON "SpareItemMovement"("spareItemId", "createdAt");

-- CreateIndex
CREATE INDEX "SpareItemMovement_userId_createdAt_idx" ON "SpareItemMovement"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SpareItemMovement" ADD CONSTRAINT "SpareItemMovement_spareItemId_fkey" FOREIGN KEY ("spareItemId") REFERENCES "SpareItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareItemMovement" ADD CONSTRAINT "SpareItemMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
