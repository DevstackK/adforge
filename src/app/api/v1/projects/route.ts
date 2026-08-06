import { z } from "zod";
import { db } from "@/lib/db";
import { created, ok, parseJson, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { audit } from "@/server/audit";

const schema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
});
export async function GET(request: Request) {
  try {
    const { organizationId } = await requireSession();
    const includeArchived =
      new URL(request.url).searchParams.get("includeArchived") === "true";
    return ok(
      await db.project.findMany({
        where: {
          organizationId,
          ...(includeArchived ? {} : { status: "ACTIVE" }),
        },
        include: {
          _count: { select: { products: true, assets: true, campaigns: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    const context = await requireSession("EDITOR");
    const input = await parseJson(request, schema);
    const project = await db.project.create({
      data: {
        ...input,
        organizationId: context.organizationId,
        createdById: context.user.id,
      },
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      after: { name: project.name },
    });
    return created(project);
  } catch (error) {
    return routeError(error);
  }
}
