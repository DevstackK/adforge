CREATE TABLE "AnalyticsInsight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsInsight_organizationId_fingerprint_key"
ON "AnalyticsInsight"("organizationId", "fingerprint");

CREATE INDEX "AnalyticsInsight_organizationId_expiresAt_idx"
ON "AnalyticsInsight"("organizationId", "expiresAt");

ALTER TABLE "AnalyticsInsight" ADD CONSTRAINT "AnalyticsInsight_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
