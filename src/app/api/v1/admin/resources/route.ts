import { z } from "zod";
import { db } from "@/lib/db";
import { ForbiddenError, AppError } from "@/lib/errors";
import { created, ok, parseJson, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";

const resources = [
  "users",
  "subscriptions",
  "flags",
  "tickets",
  "logs",
] as const;
const updateSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("flags"),
    id: z.cuid(),
    enabled: z.boolean(),
    rules: z
      .object({
        allowOrganizations: z.array(z.cuid()).max(100).optional(),
        denyOrganizations: z.array(z.cuid()).max(100).optional(),
        rolloutPercentage: z.number().int().min(0).max(100).optional(),
      })
      .optional(),
  }),
  z.object({
    resource: z.literal("tickets"),
    id: z.cuid(),
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"]),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  }),
  z.object({
    resource: z.literal("users"),
    id: z.cuid(),
    isPlatformAdmin: z.boolean(),
  }),
]);
const createFlagSchema = z.object({
  resource: z.literal("flags"),
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(3).max(500),
  enabled: z.boolean().default(false),
});

async function admin() {
  const context = await requireSession();
  if (!context.user.isPlatformAdmin)
    throw new ForbiddenError("Platform administrator access required");
  return context;
}
export async function GET(request: Request) {
  try {
    await admin();
    const resource = new URL(request.url).searchParams.get("resource");
    if (!resources.includes(resource as (typeof resources)[number]))
      throw new AppError("Invalid admin resource", "INVALID_RESOURCE", 422);
    if (resource === "users")
      return ok(
        await db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            isPlatformAdmin: true,
            createdAt: true,
            _count: { select: { memberships: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    if (resource === "subscriptions")
      return ok(
        await db.subscription.findMany({
          include: { organization: { select: { name: true, slug: true } } },
          orderBy: { updatedAt: "desc" },
          take: 100,
        }),
      );
    if (resource === "flags")
      return ok(await db.featureFlag.findMany({ orderBy: { key: "asc" } }));
    if (resource === "tickets")
      return ok(
        await db.supportTicket.findMany({
          include: {
            organization: { select: { name: true } },
            user: { select: { email: true } },
          },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          take: 100,
        }),
      );
    return ok(
      await db.auditLog.findMany({
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await admin();
    const input = await parseJson(request, updateSchema);
    let result: unknown;
    if (input.resource === "flags")
      result = await db.featureFlag.update({
        where: { id: input.id },
        data: { enabled: input.enabled, rules: input.rules },
      });
    else if (input.resource === "tickets")
      result = await db.supportTicket.update({
        where: { id: input.id },
        data: { status: input.status, priority: input.priority },
      });
    else {
      const target = await db.user.findUnique({ where: { id: input.id } });
      if (!target) throw new AppError("User not found", "NOT_FOUND", 404);
      if (target.id === context.user.id && !input.isPlatformAdmin)
        throw new AppError(
          "You cannot remove your own platform administrator access",
          "SELF_DEMOTION_FORBIDDEN",
          409,
        );
      if (target.isPlatformAdmin && !input.isPlatformAdmin) {
        const administratorCount = await db.user.count({
          where: { isPlatformAdmin: true },
        });
        if (administratorCount <= 1)
          throw new AppError(
            "At least one platform administrator is required",
            "LAST_ADMIN_PROTECTED",
            409,
          );
      }
      result = await db.user.update({
        where: { id: input.id },
        data: { isPlatformAdmin: input.isPlatformAdmin },
      });
    }
    await db.auditLog.create({
      data: {
        actorId: context.user.id,
        action: `admin.${input.resource}.update`,
        entityType: input.resource,
        entityId: input.id,
        after: input,
      },
    });
    return ok(result);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await admin();
    const input = await parseJson(request, createFlagSchema);
    const flag = await db.featureFlag.create({
      data: {
        key: input.key,
        description: input.description,
        enabled: input.enabled,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: context.user.id,
        action: "admin.flags.create",
        entityType: "flags",
        entityId: flag.id,
        after: input,
      },
    });
    return created(flag);
  } catch (error) {
    return routeError(error);
  }
}
