import { z } from "zod";
import { audit } from "@/server/audit";
import { requirePrincipal } from "@/server/auth";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ok, parseJson, routeError } from "@/lib/http";

const updateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(10_000).optional(),
    sourceUrl: z.url().nullable().optional(),
    price: z.number().nonnegative().max(999_999_999_999).nullable().optional(),
    currency: z
      .string()
      .length(3)
      .transform((value) => value.toUpperCase())
      .optional(),
    imageUrls: z.array(z.url()).max(50).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

async function product(id: string, organizationId: string) {
  const value = await db.product.findFirst({
    where: { id, project: { organizationId } },
  });
  if (!value) throw new NotFoundError("Product");
  return value;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePrincipal(
      request,
      "EDITOR",
      "products:write",
    );
    const { id } = await context.params;
    const before = await product(id, principal.organizationId);
    const input = await parseJson(request, updateSchema);
    const updated = await db.product.update({ where: { id }, data: input });
    await audit({
      organizationId: principal.organizationId,
      actorId: principal.user.id,
      action: "product.update",
      entityType: "product",
      entityId: id,
      before: { name: before.name, sourceUrl: before.sourceUrl },
      after: { name: updated.name, sourceUrl: updated.sourceUrl },
    });
    return ok(updated);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePrincipal(
      request,
      "EDITOR",
      "products:write",
    );
    const { id } = await context.params;
    const before = await product(id, principal.organizationId);
    const campaignCount = await db.campaign.count({ where: { productId: id } });
    if (campaignCount)
      throw new ConflictError(
        "Remove this product from its campaigns before deleting it",
      );
    await db.product.delete({ where: { id } });
    await audit({
      organizationId: principal.organizationId,
      actorId: principal.user.id,
      action: "product.delete",
      entityType: "product",
      entityId: id,
      before: { name: before.name, sourceUrl: before.sourceUrl },
    });
    return ok({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
