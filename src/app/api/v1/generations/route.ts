import { db } from "@/lib/db";
import { ok, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
export async function GET(request: Request) {
  try {
    const { organizationId } = await requirePrincipal(
      request,
      "VIEWER",
      "creative:read",
    );
    return ok(
      await db.generation.findMany({
        where: { organizationId },
        include: { outputAsset: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
