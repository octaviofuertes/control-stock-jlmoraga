-- CreateTable
CREATE TABLE "AiRecommendationSnapshot" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "recommendations" JSONB NOT NULL,
    "brandAnalytics" JSONB NOT NULL,
    "sourceStats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRecommendationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiRecommendationSnapshot_weekKey_key" ON "AiRecommendationSnapshot"("weekKey");
