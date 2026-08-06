import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { ok, routeError } from "@/lib/http";
import { campaignQueue, generationQueue } from "@/server/queue";
import { requireSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession("VIEWER");
    if (!user.isPlatformAdmin)
      throw new ForbiddenError("Platform administrator access required");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const started = performance.now();
    const [database, failedGenerations, failedCampaigns, unhealthyConnections] =
      await Promise.all([
        db.$queryRaw`SELECT 1`,
        db.generation.count({
          where: { status: "FAILED", updatedAt: { gte: since } },
        }),
        db.campaign.count({
          where: { status: "FAILED", updatedAt: { gte: since } },
        }),
        db.adConnection.count({
          where: { status: { in: ["EXPIRED", "REVOKED", "ERROR"] } },
        }),
      ]);
    void database;
    let queues:
      | {
          status: "up";
          generations: Record<string, number>;
          campaigns: Record<string, number>;
        }
      | { status: "down"; error: string };
    try {
      const [generations, campaigns] = await Promise.all([
        generationQueue.getJobCounts(
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
        ),
        campaignQueue.getJobCounts(
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
        ),
      ]);
      queues = { status: "up", generations, campaigns };
    } catch (error) {
      queues = {
        status: "down",
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Redis unavailable",
      };
    }
    return ok({
      status: queues.status === "up" ? "healthy" : "degraded",
      database: {
        status: "up",
        latencyMs: Math.round(performance.now() - started),
      },
      queues,
      failures24h: {
        generations: failedGenerations,
        campaigns: failedCampaigns,
      },
      unhealthyConnections,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return routeError(error);
  }
}
