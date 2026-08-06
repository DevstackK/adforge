import { db } from "@/lib/db";
import { ok, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { creditBalance } from "@/server/credits";
export async function GET() {
  try {
    const { organizationId } = await requireSession("VIEWER");
    const since = new Date(Date.now() - 30 * 86400000);
    const [balance, records, ledger] = await Promise.all([
      creditBalance(organizationId),
      db.usageRecord.groupBy({
        by: ["metric", "unit"],
        where: { organizationId, recordedAt: { gte: since } },
        _sum: { quantity: true, costCents: true },
      }),
      db.creditTransaction.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);
    return ok({ balance, periodDays: 30, records, ledger });
  } catch (error) {
    return routeError(error);
  }
}
