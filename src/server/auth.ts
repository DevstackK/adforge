import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { Role } from "@/generated/prisma/client";
import { sha256 } from "@/lib/crypto";

const hierarchy: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  EDITOR: 3,
  ANALYST: 2,
  VIEWER: 1,
};

export async function requireSession(minimumRole: Role = "VIEWER") {
  const session = await auth();
  if (!session.userId) throw new UnauthorizedError();
  const user = await db.user.findUnique({ where: { clerkId: session.userId } });
  if (!user) throw new UnauthorizedError("User profile is not provisioned");
  const organizationId = session.orgId
    ? (
        await db.organization.findUnique({
          where: { clerkOrgId: session.orgId },
          select: { id: true },
        })
      )?.id
    : undefined;
  if (!organizationId)
    throw new ForbiddenError("Select an organization to continue");
  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
  });
  if (!membership || hierarchy[membership.role] < hierarchy[minimumRole])
    throw new ForbiddenError();
  return { session, user, membership, organizationId };
}

export async function provisionCurrentUser() {
  const clerk = await currentUser();
  if (!clerk) throw new UnauthorizedError();
  const email = clerk.primaryEmailAddress?.emailAddress;
  if (!email) throw new UnauthorizedError("A verified email is required");
  return db.user.upsert({
    where: { clerkId: clerk.id },
    update: {
      email,
      name: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || null,
      avatarUrl: clerk.imageUrl,
    },
    create: {
      clerkId: clerk.id,
      email,
      name: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || null,
      avatarUrl: clerk.imageUrl,
    },
  });
}

export async function requirePrincipal(
  request: Request,
  minimumRole: Role = "VIEWER",
  requiredScope?: string,
) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer af_"))
    return requireSession(minimumRole);
  const secret = authorization.slice("Bearer ".length);
  const key = await db.apiKey.findUnique({
    where: { secretHash: sha256(secret) },
    include: { user: true },
  });
  if (
    !key ||
    key.status !== "ACTIVE" ||
    (key.expiresAt && key.expiresAt <= new Date())
  )
    throw new UnauthorizedError("API key is invalid or expired");
  if (
    requiredScope &&
    !key.scopes.includes("*") &&
    !key.scopes.includes(requiredScope)
  )
    throw new ForbiddenError(`API key requires the ${requiredScope} scope`);
  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: key.userId,
        organizationId: key.organizationId,
      },
    },
  });
  if (!membership || hierarchy[membership.role] < hierarchy[minimumRole])
    throw new ForbiddenError();
  await db.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
  return {
    session: null,
    user: key.user,
    membership,
    organizationId: key.organizationId,
  };
}
