import { campaignSchema } from "@/features/campaigns/schemas";
import { createCampaign } from "@/features/campaigns/service";
import { db } from "@/lib/db";
import { created, ok, parseJson, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
import { audit } from "@/server/audit";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requirePrincipal(
      request,
      "VIEWER",
      "campaigns:read",
    );
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const campaigns = await db.campaign.findMany({
      where: { organizationId },
      include: { _count: { select: { creatives: true } } },
      orderBy: { createdAt: "desc" },
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const nextCursor = campaigns.length > 20 ? campaigns.pop()?.id : null;
    return ok({ items: campaigns, nextCursor });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requirePrincipal(
      request,
      "EDITOR",
      "campaigns:write",
    );
    const input = await parseJson(request, campaignSchema);
    const campaign = await createCampaign({
      ...input,
      organizationId: context.organizationId,
      userId: context.user.id,
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "campaign.create",
      entityType: "campaign",
      entityId: campaign.id,
      after: {
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
      },
    });
    return created(campaign);
  } catch (error) {
    return routeError(error);
  }
}
