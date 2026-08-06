import { db } from "@/lib/db";
import { ok, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";

const clientFlags = ["talking-avatar", "linkedin-publishing"] as const;

export async function GET() {
  try {
    const { organizationId } = await requireSession("VIEWER");
    const configured = await db.featureFlag.findMany({
      where: { key: { in: [...clientFlags] } },
      select: { key: true },
    });
    const known = new Set(configured.map((flag) => flag.key));
    return ok(
      Object.fromEntries(
        await Promise.all(
          clientFlags.map(async (key) => [
            key,
            await isFeatureEnabled(key, organizationId, !known.has(key)),
          ]),
        ),
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}
