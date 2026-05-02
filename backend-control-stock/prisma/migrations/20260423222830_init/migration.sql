-- CreateEnum
CREATE TYPE "TireState" AS ENUM ('NUEVA', 'USADA', 'REPARADA', 'BAJA');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('DEPOSIT', 'TRACTOR', 'SEMI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tractor" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semi" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Semi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tire" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "state" "TireState" NOT NULL,
    "notes" TEXT,
    "currentLocation" "LocationType" NOT NULL,
    "currentDepositId" TEXT,
    "currentTractorId" TEXT,
    "currentSemiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "tireId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousLocation" "LocationType" NOT NULL,
    "newLocation" "LocationType" NOT NULL,
    "previousDepositId" TEXT,
    "previousTractorId" TEXT,
    "previousSemiId" TEXT,
    "newDepositId" TEXT,
    "newTractorId" TEXT,
    "newSemiId" TEXT,
    "previousPlate" TEXT,
    "newPlate" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_name_key" ON "Deposit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tractor_plate_key" ON "Tractor"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Semi_plate_key" ON "Semi"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Tire_code_key" ON "Tire"("code");

-- CreateIndex
CREATE INDEX "Tire_currentLocation_idx" ON "Tire"("currentLocation");

-- CreateIndex
CREATE INDEX "Tire_currentDepositId_idx" ON "Tire"("currentDepositId");

-- CreateIndex
CREATE INDEX "Tire_currentTractorId_idx" ON "Tire"("currentTractorId");

-- CreateIndex
CREATE INDEX "Tire_currentSemiId_idx" ON "Tire"("currentSemiId");

-- CreateIndex
CREATE INDEX "Movement_tireId_createdAt_idx" ON "Movement"("tireId", "createdAt");

-- CreateIndex
CREATE INDEX "Movement_createdAt_idx" ON "Movement"("createdAt");

-- AddForeignKey
ALTER TABLE "Tire" ADD CONSTRAINT "Tire_currentDepositId_fkey" FOREIGN KEY ("currentDepositId") REFERENCES "Deposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tire" ADD CONSTRAINT "Tire_currentTractorId_fkey" FOREIGN KEY ("currentTractorId") REFERENCES "Tractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tire" ADD CONSTRAINT "Tire_currentSemiId_fkey" FOREIGN KEY ("currentSemiId") REFERENCES "Semi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_tireId_fkey" FOREIGN KEY ("tireId") REFERENCES "Tire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
