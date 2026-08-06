import { z } from "zod";
import { audit } from "@/server/audit";
import { requireSession } from "@/server/auth";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { ok, parseJson, routeError } from "@/lib/http";

const schema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(1000).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requireSession("EDITOR");
    const { id } = await context.params;
    const before = await db.project.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!before) throw new NotFoundError("Project");
    const input = await parseJson(request, schema);
    const updated = await db.project.update({ where: { id }, data: input });
    await audit({
      organizationId: principal.organizationId,
      actorId: principal.user.id,
      action: "project.update",
      entityType: "project",
      entityId: id,
      before: { name: before.name, status: before.status },
      after: { name: updated.name, status: updated.status },
    });
    return ok(updated);
  } catch (error) {
    return routeError(error);
  }
}
