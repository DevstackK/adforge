import { z } from "zod";
import { audit } from "@/server/audit";
import { requirePrincipal } from "@/server/auth";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ok, parseJson, routeError } from "@/lib/http";

const schema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    colors: z
      .object({
        primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })
      .optional(),
    typography: z
      .object({ heading: z.string().min(1), body: z.string().min(1) })
      .optional(),
    voice: z
      .object({
        tone: z.array(z.string()),
        forbiddenTerms: z.array(z.string()),
        productClaims: z.array(z.string()),
      })
      .optional(),
    logoAssetId: z.cuid().nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

async function kit(id: string, organizationId: string) {
  const value = await db.brandKit.findFirst({ where: { id, organizationId } });
  if (!value) throw new NotFoundError("Brand kit");
  return value;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePrincipal(
      request,
      "ADMIN",
      "creative:write",
    );
    const { id } = await context.params;
    const before = await kit(id, principal.organizationId);
    const input = await parseJson(request, schema);
    if (input.logoAssetId) {
      const logo = await db.asset.findFirst({
        where: {
          id: input.logoAssetId,
          organizationId: principal.organizationId,
          type: "LOGO",
        },
      });
      if (!logo) throw new NotFoundError("Logo asset");
    }
    const updated = await db.$transaction(async (tx) => {
      if (input.isDefault)
        await tx.brandKit.updateMany({
          where: { organizationId: principal.organizationId, id: { not: id } },
          data: { isDefault: false },
        });
      return tx.brandKit.update({ where: { id }, data: input });
    });
    await audit({
      organizationId: principal.organizationId,
      actorId: principal.user.id,
      action: "brand_kit.update",
      entityType: "brand_kit",
      entityId: id,
      before: { name: before.name, isDefault: before.isDefault },
      after: { name: updated.name, isDefault: updated.isDefault },
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
      "ADMIN",
      "creative:write",
    );
    const { id } = await context.params;
    const before = await kit(id, principal.organizationId);
    if (before.isDefault)
      throw new ConflictError(
        "Choose another default brand kit before deleting this one",
      );
    await db.brandKit.delete({ where: { id } });
    await audit({
      organizationId: principal.organizationId,
      actorId: principal.user.id,
      action: "brand_kit.delete",
      entityType: "brand_kit",
      entityId: id,
      before: { name: before.name },
    });
    return ok({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
