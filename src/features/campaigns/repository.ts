import type { z } from "zod";
import type { db as database } from "@/lib/db";
import type { campaignSchema } from "./schemas";

type CampaignInput = z.infer<typeof campaignSchema> & {
  organizationId: string;
  userId: string;
};

export interface CampaignCreationRepository {
  projectExists(projectId: string, organizationId: string): Promise<boolean>;
  assetsByIds(
    ids: string[],
    organizationId: string,
  ): ReturnType<typeof database.asset.findMany>;
  create(input: CampaignInput): ReturnType<typeof database.campaign.create>;
}

export class PrismaCampaignRepository implements CampaignCreationRepository {
  constructor(private readonly client: typeof database) {}

  async projectExists(projectId: string, organizationId: string) {
    return Boolean(
      await this.client.project.findFirst({
        where: { id: projectId, organizationId, status: "ACTIVE" },
        select: { id: true },
      }),
    );
  }

  assetsByIds(ids: string[], organizationId: string) {
    return this.client.asset.findMany({
      where: { id: { in: ids }, organizationId },
    });
  }

  create(input: CampaignInput) {
    return this.client.campaign.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        createdById: input.userId,
        productId: input.productId,
        brandKitId: input.brandKitId,
        adConnectionId: input.adConnectionId,
        platform: input.platform,
        name: input.name,
        objective: input.objective,
        dailyBudget: input.dailyBudget,
        lifetimeBudget: input.lifetimeBudget,
        currency: input.currency,
        audience: input.audience,
        schedule: input.schedule,
        settings: { copy: input.copy, creativeFormat: input.creativeFormat },
        creatives: {
          create: input.creativeAssetIds.map((assetId, position) => ({
            assetId,
            position,
            copy: input.copy,
          })),
        },
      },
      include: { creatives: true },
    });
  }
}
