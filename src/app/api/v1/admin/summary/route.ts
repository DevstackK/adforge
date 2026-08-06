import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { ok, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
export async function GET() {
  try {
    const { user } = await requireSession("VIEWER");
    if (!user.isPlatformAdmin)
      throw new ForbiddenError("Platform administrator access required");
    const [users, organizations, activeSubscriptions, tickets, revenue] =
      await Promise.all([
        db.user.count(),
        db.organization.count(),
        db.subscription.count({
          where: { status: { in: ["ACTIVE", "TRIALING"] } },
        }),
        db.supportTicket.count({
          where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
        }),
        db.invoice.aggregate({
          where: { status: "paid" },
          _sum: { amountPaid: true },
        }),
      ]);
    return ok({
      users,
      organizations,
      activeSubscriptions,
      openTickets: tickets,
      revenue: Number(revenue._sum.amountPaid ?? 0),
    });
  } catch (error) {
    return routeError(error);
  }
}
