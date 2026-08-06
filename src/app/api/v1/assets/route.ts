import { db } from "@/lib/db";
import { created, ok, parseJson, routeError } from "@/lib/http";
import { requirePrincipal, requireSession } from "@/server/auth";
import { z } from "zod";
import { inspectObject } from "@/server/storage";
import { AppError, NotFoundError } from "@/lib/errors";
import { audit } from "@/server/audit";
const assetSchema = z.object({
  projectId: z.cuid().optional(),
  key: z.string().min(1).max(1000),
  name: z.string().min(1).max(255),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "LOGO", "FONT", "DOCUMENT"]),
  mimeType: z.string().min(3).max(120),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().optional(),
});
export async function GET(request: Request) {
  try {
    const { organizationId } = await requirePrincipal(
      request,
      "VIEWER",
      "creative:read",
    );
    const type = z
      .enum(["IMAGE", "VIDEO", "AUDIO", "LOGO", "FONT", "DOCUMENT"])
      .optional()
      .parse(new URL(request.url).searchParams.get("type") ?? undefined);
    return ok(
      await db.asset.findMany({
        where: {
          organizationId,
          ...(type ? { type } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireSession("EDITOR");
    const input = await parseJson(request, assetSchema);
    if (
      !input.key.startsWith(`organizations/${context.organizationId}/uploads/`)
    )
      throw new AppError(
        "Upload key does not belong to this organization",
        "INVALID_UPLOAD",
        403,
      );
    if (
      input.projectId &&
      !(await db.project.findFirst({
        where: { id: input.projectId, organizationId: context.organizationId },
      }))
    )
      throw new NotFoundError("Project");
    const object = await inspectObject(input.key);
    if (!object.ContentLength || object.ContentLength > 500_000_000)
      throw new AppError(
        "Uploaded object is missing or invalid",
        "INVALID_UPLOAD",
        422,
      );
    const asset = await db.asset.create({
      data: {
        organizationId: context.organizationId,
        projectId: input.projectId,
        storageKey: input.key,
        url: `s3://${process.env.S3_BUCKET}/${input.key}`,
        name: input.name,
        type: input.type,
        mimeType: input.mimeType,
        bytes: object.ContentLength,
        width: input.width,
        height: input.height,
        durationMs: input.durationMs,
        checksum: object.ETag?.replaceAll('"', ""),
      },
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "asset.create",
      entityType: "asset",
      entityId: asset.id,
      after: { name: asset.name, type: asset.type, bytes: String(asset.bytes) },
    });
    return created(asset);
  } catch (error) {
    return routeError(error);
  }
}
