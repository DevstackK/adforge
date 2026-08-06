ALTER TABLE "CampaignCreative" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "CampaignCreative_campaignId_externalId_key"
ON "CampaignCreative"("campaignId", "externalId");

CREATE INDEX "CampaignCreative_externalId_idx"
ON "CampaignCreative"("externalId");
