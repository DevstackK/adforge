import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function audit(input: {
  organizationId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  return db.auditLog.create({
    data: {
      ...input,
      ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
      userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
    },
  });
}
