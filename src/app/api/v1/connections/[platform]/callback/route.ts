import { completeOAuth } from "@/features/connections/oauth";
import { AppError } from "@/lib/errors";
import { routeError } from "@/lib/http";
import type { CampaignPlatform } from "@/generated/prisma/client";
import { requireSession } from "@/server/auth";
import { audit } from "@/server/audit";
const supported = ["META", "GOOGLE", "TIKTOK", "PINTEREST", "LINKEDIN"];
export async function GET(
  request: Request,
  context: { params: Promise<{ platform: string }> },
) {
  try {
    const session = await requireSession("ADMIN");
    const { platform: raw } = await context.params;
    const platform = raw.toUpperCase() as CampaignPlatform;
    if (!supported.includes(platform))
      throw new AppError(
        "Unsupported advertising platform",
        "INVALID_PLATFORM",
        404,
      );
    const url = new URL(request.url),
      code = url.searchParams.get("code"),
      state = url.searchParams.get("state");
    if (!code || !state)
      throw new AppError(
        "OAuth callback is missing code or state",
        "OAUTH_ERROR",
        422,
      );
    const connections = await completeOAuth(platform, code, state, {
      organizationId: session.organizationId,
      userId: session.user.id,
    });
    await audit({
      organizationId: session.organizationId,
      actorId: session.user.id,
      action: "ad_connection.connect",
      entityType: "ad_connection",
      metadata: {
        platform,
        connectionIds: connections.map((connection) => connection.id),
      },
    });
    return Response.redirect(
      `${url.origin}/settings?connection=${raw}&status=connected`,
      302,
    );
  } catch (error) {
    return routeError(error);
  }
}
