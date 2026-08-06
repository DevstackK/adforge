import { db } from "@/lib/db";
import { ok, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
export async function GET(request: Request) {
  try {
    const { organizationId } = await requirePrincipal(
      request,
      "VIEWER",
      "products:read",
    );
    return ok(
      await db.product.findMany({
        where: { project: { organizationId } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
