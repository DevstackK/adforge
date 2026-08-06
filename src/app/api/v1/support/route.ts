import { z } from "zod";
import { db } from "@/lib/db";
import { created, ok, parseJson, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { audit } from "@/server/audit";
const schema = z.object({
  subject: z.string().min(3).max(160),
  body: z.string().min(20).max(10000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});
export async function GET() {
  try {
    const context = await requireSession();
    return ok(
      await db.supportTicket.findMany({
        where: {
          organizationId: context.organizationId,
          userId: context.user.id,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    const context = await requireSession();
    const input = await parseJson(request, schema);
    const ticket = await db.supportTicket.create({
      data: {
        ...input,
        organizationId: context.organizationId,
        userId: context.user.id,
      },
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "support_ticket.create",
      entityType: "support_ticket",
      entityId: ticket.id,
      after: { subject: ticket.subject, priority: ticket.priority },
    });
    return created(ticket);
  } catch (error) {
    return routeError(error);
  }
}
