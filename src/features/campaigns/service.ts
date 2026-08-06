import { db } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { campaignQueue } from "@/server/queue";
import { platformAdapter } from "./adapters";
import { validAccessToken } from "@/features/connections/oauth";
import type { z } from "zod";
import type { campaignSchema } from "./schemas";
import type { Prisma } from "@/generated/prisma/client";
import type { CampaignCreationRepository } from "./repository";
import { repositories } from "@/server/container";
import { isFeatureEnabled } from "@/server/features";

export async function createCampaign(
  input: z.infer<typeof campaignSchema> & {
    organizationId: string;
    userId: string;
  },
  repository: CampaignCreationRepository = repositories.campaigns,
) {
  if (
    input.platform === "LINKEDIN" &&
    !(await isFeatureEnabled("linkedin-publishing", input.organizationId))
  )
    throw new AppError(
      "LinkedIn publishing is not enabled for this organization",
      "FEATURE_DISABLED",
      403,
    );
  if (!(await repository.projectExists(input.projectId, input.organizationId)))
    throw new NotFoundError("Project");
  const assets = await repository.assetsByIds(
    input.creativeAssetIds,
    input.organizationId,
  );
  if (assets.length !== new Set(input.creativeAssetIds).size)
    throw new AppError(
      "One or more creative assets are invalid",
      "INVALID_CREATIVES",
      422,
    );
  if (
    input.creativeFormat === "CAROUSEL" &&
    assets.some((asset) => asset.type !== "IMAGE")
  )
    throw new AppError(
      "Meta carousel campaigns require image assets",
      "INVALID_CREATIVES",
      422,
    );
  return repository.create(input);
}

export async function enqueuePublish(
  campaignId: string,
  organizationId: string,
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: { creatives: { include: { asset: true } }, adConnection: true },
  });
  if (!campaign) throw new NotFoundError("Campaign");
  if (!campaign.adConnection)
    throw new AppError(
      "Connect an advertising account before publishing",
      "CONNECTION_REQUIRED",
      422,
    );
  if (!["DRAFT", "FAILED", "PAUSED"].includes(campaign.status))
    throw new AppError(
      `Campaign cannot be published from ${campaign.status}`,
      "INVALID_STATE",
      409,
    );
  await db.campaign.update({
    where: { id: campaign.id },
    data: { status: "VALIDATING" },
  });
  await campaignQueue.add(
    "publish",
    { campaignId, organizationId, action: "publish" },
    {
      jobId: `publish-${campaignId}-${Date.now()}`,
      // Most ad networks do not provide a cross-resource idempotency key.
      // Avoid automatic duplicate campaign creation; failed publishes remain
      // explicitly retryable by the user after reviewing the provider error.
      attempts: 1,
    },
  );
  return { id: campaign.id, status: "VALIDATING" as const };
}

export async function publishCampaign(
  campaignId: string,
  organizationId: string,
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: { creatives: { include: { asset: true } }, adConnection: true },
  });
  if (!campaign?.adConnection)
    throw new NotFoundError("Campaign or ad connection");
  const connection = campaign.adConnection;
  await db.campaign.update({
    where: { id: campaign.id },
    data: { status: "PUBLISHING" },
  });
  const adapter = platformAdapter(campaign.platform);
  const result = await adapter.publish(
    { ...campaign, adConnection: connection },
    await validAccessToken(connection),
    connection.externalAccountId,
  );
  return db.$transaction(async (tx) => {
    for (const creative of result.creatives ?? [])
      await tx.campaignCreative.updateMany({
        where: { id: creative.localId, campaignId: campaign.id },
        data: { externalId: creative.externalId },
      });
    return tx.campaign.update({
      where: { id: campaign.id },
      data: {
        externalId: result.externalId,
        status: result.status,
        publishedAt: new Date(),
        settings: {
          ...(campaign.settings as object),
          publishResponse: result.raw as object,
        },
      },
    });
  });
}

export async function syncCampaignMetrics(
  campaignId: string,
  organizationId: string,
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: { adConnection: true, creatives: true },
  });
  if (!campaign?.adConnection || !campaign.externalId)
    throw new NotFoundError("Published campaign");
  const result = await platformAdapter(campaign.platform).metrics(
    campaign,
    await validAccessToken(campaign.adConnection),
    campaign.adConnection.externalAccountId,
  );
  const recordedAt = new Date();
  recordedAt.setMinutes(0, 0, 0);
  const data = {
    impressions: result.impressions,
    clicks: result.clicks,
    conversions: result.conversions,
    spend: result.spend,
    revenue: result.revenue,
    raw: result.raw as Prisma.InputJsonValue,
  };
  return db.$transaction(async (tx) => {
    const metric = await tx.campaignMetric.upsert({
      where: { campaignId_recordedAt: { campaignId, recordedAt } },
      update: data,
      create: { campaignId, recordedAt, ...data },
    });
    for (const providerMetric of result.creatives ?? []) {
      const creative = campaign.creatives.find(
        (item) => item.externalId === providerMetric.externalId,
      );
      if (!creative) continue;
      const creativeData = {
        impressions: providerMetric.impressions,
        clicks: providerMetric.clicks,
        conversions: providerMetric.conversions,
        spend: providerMetric.spend,
        revenue: providerMetric.revenue,
        raw: providerMetric.raw as Prisma.InputJsonValue,
      };
      await tx.creativeMetric.upsert({
        where: {
          creativeId_recordedAt: { creativeId: creative.id, recordedAt },
        },
        update: creativeData,
        create: { creativeId: creative.id, recordedAt, ...creativeData },
      });
    }
    return metric;
  });
}

export async function setCampaignStatus(
  campaignId: string,
  organizationId: string,
  status: "ACTIVE" | "PAUSED",
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: { adConnection: true },
  });
  if (!campaign?.adConnection || !campaign.externalId)
    throw new NotFoundError("Published campaign");
  await platformAdapter(campaign.platform).setStatus(
    campaign,
    await validAccessToken(campaign.adConnection),
    campaign.adConnection.externalAccountId,
    status,
  );
  return db.campaign.update({ where: { id: campaign.id }, data: { status } });
}
