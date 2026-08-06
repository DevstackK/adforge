import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { created, ok, parseJson, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { audit } from "@/server/audit";
const createSchema = z.object({
  name: z.string().min(2).max(100),
  scopes: z
    .array(
      z.enum([
        "products:read",
        "products:write",
        "creative:read",
        "creative:write",
        "campaigns:read",
        "campaigns:write",
        "analytics:read",
      ]),
    )
    .min(1),
  expiresAt: z.iso.datetime().optional(),
});
const revokeSchema = z.object({ id: z.cuid() });
export async function GET() {
  try {
    const { organizationId } = await requireSession("ADMIN");
    return ok(
      await db.apiKey.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          status: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
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
    const context = await requireSession("ADMIN");
    const input = await parseJson(request, createSchema);
    const secret = `af_live_${randomBytes(32).toString("base64url")}`;
    const key = await db.apiKey.create({
      data: {
        organizationId: context.organizationId,
        userId: context.user.id,
        name: input.name,
        prefix: secret.slice(0, 16),
        secretHash: sha256(secret),
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "api_key.create",
      entityType: "api_key",
      entityId: key.id,
      after: { name: key.name, scopes: key.scopes },
    });
    return created({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      secret,
      warning: "Copy this key now. It cannot be retrieved again.",
    });
  } catch (error) {
    return routeError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const context = await requireSession("ADMIN");
    const { id } = await parseJson(request, revokeSchema);
    const key = await db.apiKey.updateMany({
      where: { id, organizationId: context.organizationId },
      data: { status: "REVOKED" },
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "api_key.revoke",
      entityType: "api_key",
      entityId: id,
    });
    return ok({ revoked: key.count === 1 });
  } catch (error) {
    return routeError(error);
  }
}
