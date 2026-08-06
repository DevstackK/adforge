import { publishCampaignSchema } from "@/features/campaigns/schemas";
import { enqueuePublish } from "@/features/campaigns/service";
import { ok, parseJson, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
import { audit } from "@/server/audit";

export async function POST(request: Request) {
  try {
    const context = await requirePrincipal(request, "ADMIN", "campaigns:write");
    const { campaignId } = await parseJson(request, publishCampaignSchema);
    const result = await enqueuePublish(campaignId, context.organizationId);
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "campaign.publish.requested",
      entityType: "campaign",
      entityId: campaignId,
      after: { status: result.status },
    });
    return ok(result, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
