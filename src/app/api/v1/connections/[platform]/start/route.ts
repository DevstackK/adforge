import { authorizationUrl } from "@/features/connections/oauth";
import { AppError } from "@/lib/errors";
import { routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import type { CampaignPlatform } from "@/generated/prisma/client";
import { env } from "@/lib/env";
const supported = ["META", "GOOGLE", "TIKTOK", "PINTEREST", "LINKEDIN"];
export async function GET(
  _: Request,
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
    return Response.redirect(
      await authorizationUrl(
        platform,
        session.organizationId,
        session.user.id,
        env().APP_URL,
      ),
      302,
    );
  } catch (error) {
    return routeError(error);
  }
}
