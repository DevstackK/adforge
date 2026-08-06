ALTER TABLE "CampaignCreative"
DROP CONSTRAINT "CampaignCreative_assetId_fkey";

ALTER TABLE "CampaignCreative"
ADD CONSTRAINT "CampaignCreative_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
