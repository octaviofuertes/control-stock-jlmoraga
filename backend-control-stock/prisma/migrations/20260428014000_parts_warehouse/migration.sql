-- CreateEnum
CREATE TYPE "SpareCategory" AS ENUM ('FOCOS', 'FERRETERIA');

-- CreateTable
CREATE TABLE "SpareItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SpareCategory" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpareItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OilStock" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "capacityLiters" INTEGER NOT NULL DEFAULT 1000,
    "currentLiters" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OilStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OilStock_key_key" ON "OilStock"("key");
