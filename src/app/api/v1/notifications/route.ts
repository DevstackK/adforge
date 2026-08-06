import { z } from "zod";
import { db } from "@/lib/db";
import { ok, parseJson, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
export async function GET() {
  try {
    const { organizationId, user } = await requireSession();
    return ok(
      await db.notification.findMany({
        where: { organizationId, OR: [{ userId: user.id }, { userId: null }] },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
const schema = z.object({ ids: z.array(z.cuid()).min(1).max(100) });
export async function PATCH(request: Request) {
  try {
    const { organizationId, user } = await requireSession();
    const { ids } = await parseJson(request, schema);
    await db.notification.updateMany({
      where: {
        id: { in: ids },
        organizationId,
        OR: [{ userId: user.id }, { userId: null }],
      },
      data: { readAt: new Date() },
    });
    return ok({ updated: ids.length });
  } catch (error) {
    return routeError(error);
  }
}
