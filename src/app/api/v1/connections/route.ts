import { db } from "@/lib/db";
import { ok, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { parseJson } from "@/lib/http";
import { z } from "zod";
import { NotFoundError } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
export async function GET() {
  try {
    const { organizationId } = await requireSession("VIEWER");
    return ok(
      await db.adConnection.findMany({
        where: { organizationId },
        select: {
          id: true,
          platform: true,
          externalAccountId: true,
          name: true,
          status: true,
          tokenExpiresAt: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}

const configurationSchema = z.object({
  connectionId: z.cuid(),
  pageId: z.string().min(1).max(100).optional(),
  pixelId: z.string().min(1).max(100).optional(),
  appId: z.string().min(1).max(100).optional(),
  identityId: z.string().min(1).max(200).optional(),
  boardId: z.string().min(1).max(200).optional(),
});

export async function PATCH(request: Request) {
  try {
    const context = await requireSession("ADMIN");
    const input = await parseJson(request, configurationSchema);
    const connection = await db.adConnection.findFirst({
      where: { id: input.connectionId, organizationId: context.organizationId },
    });
    if (!connection) throw new NotFoundError("Advertising connection");
    const metadata = connection.metadata as Record<string, unknown>;
    const pages = (metadata.pages as Array<{ id: string }> | undefined) ?? [];
    if (
      input.pageId &&
      pages.length &&
      !pages.some((page) => page.id === input.pageId)
    )
      throw new NotFoundError("Accessible Meta page");
    const updates = Object.fromEntries(
      Object.entries({
        pageId: input.pageId,
        pixelId: input.pixelId,
        appId: input.appId,
        identityId: input.identityId,
        boardId: input.boardId,
      }).filter(([, value]) => value !== undefined),
    );
    const updated = await db.adConnection.update({
      where: { id: connection.id },
      data: {
        metadata: { ...metadata, ...updates } as Prisma.InputJsonValue,
      },
      select: { id: true, platform: true, metadata: true, updatedAt: true },
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "ad_connection.configure",
      entityType: "ad_connection",
      entityId: connection.id,
      metadata: { platform: connection.platform, fields: Object.keys(updates) },
    });
    return ok(updated);
  } catch (error) {
    return routeError(error);
  }
}
