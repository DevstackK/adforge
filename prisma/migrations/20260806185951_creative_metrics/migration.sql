-- CreateTable
CREATE TABLE "CreativeMetric" (
    "id" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "clicks" BIGINT NOT NULL DEFAULT 0,
    "conversions" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "raw" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "CreativeMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreativeMetric_recordedAt_idx" ON "CreativeMetric"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeMetric_creativeId_recordedAt_key" ON "CreativeMetric"("creativeId", "recordedAt");

-- AddForeignKey
ALTER TABLE "CreativeMetric" ADD CONSTRAINT "CreativeMetric_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "CampaignCreative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
