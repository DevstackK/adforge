import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ok, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
import { createDownloadUrl, deleteObject } from "@/server/storage";
import { audit } from "@/server/audit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePrincipal(request, "VIEWER", "creative:read");
    const { id } = await context.params;
    const asset = await db.asset.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!asset) throw new NotFoundError("Asset");
    return Response.redirect(await createDownloadUrl(asset.storageKey), 307);
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
      "creative:write",
    );
    const { id } = await context.params;
    const asset = await db.asset.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!asset) throw new NotFoundError("Asset");
    if (await db.campaignCreative.count({ where: { assetId: id } }))
      throw new ConflictError(
        "Remove this asset from campaign drafts before deleting it",
      );
    await deleteObject(asset.storageKey);
    await db.$transaction([
      db.brandKit.updateMany({
        where: { organizationId: principal.organizationId, logoAssetId: id },
        data: { logoAssetId: null },
      }),
      db.asset.delete({ where: { id } }),
    ]);
    await audit({
      organizationId: principal.organizationId,
      actorId: principal.user.id,
      action: "asset.delete",
      entityType: "asset",
      entityId: id,
      before: {
        name: asset.name,
        type: asset.type,
        storageKey: asset.storageKey,
      },
    });
    return ok({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
