import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { ok, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { created, parseJson } from "@/lib/http";
export async function GET() {
  try {
    const context = await requireSession("VIEWER");
    const members = await db.membership.findMany({
      where: { organizationId: context.organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return ok({
      members,
      currentUserId: context.user.id,
      canManage: ["OWNER", "ADMIN"].includes(context.membership.role),
    });
  } catch (error) {
    return routeError(error);
  }
}

const membershipSchema = z.object({
  membershipId: z.cuid(),
  role: z.enum(["ADMIN", "EDITOR", "ANALYST", "VIEWER"]),
});

async function manageableMembership(
  membershipId: string,
  organizationId: string,
) {
  const membership = await db.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: { user: { select: { clerkId: true } } },
  });
  if (!membership) throw new NotFoundError("Membership");
  if (membership.role === "OWNER")
    throw new AppError(
      "The organization owner cannot be changed here",
      "OWNER_PROTECTED",
      409,
    );
  return membership;
}

export async function PATCH(request: Request) {
  try {
    const context = await requireSession("ADMIN");
    const input = await parseJson(request, membershipSchema);
    const membership = await manageableMembership(
      input.membershipId,
      context.organizationId,
    );
    if (!context.session.orgId)
      throw new AppError(
        "Clerk organization is not selected",
        "ORG_REQUIRED",
        409,
      );
    const clerk = await clerkClient();
    await clerk.organizations.updateOrganizationMembership({
      organizationId: context.session.orgId,
      userId: membership.user.clerkId,
      role: input.role === "ADMIN" ? "org:admin" : "org:member",
    });
    await clerk.organizations.updateOrganizationMembershipMetadata({
      organizationId: context.session.orgId,
      userId: membership.user.clerkId,
      publicMetadata: { adforgeRole: input.role },
    });
    const updated = await db.membership.update({
      where: { id: membership.id },
      data: { role: input.role },
      include: { user: true },
    });
    await db.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorId: context.user.id,
        action: "team.role.update",
        entityType: "membership",
        entityId: membership.id,
        before: { role: membership.role },
        after: { role: input.role },
      },
    });
    return ok(updated);
  } catch (error) {
    return routeError(error);
  }
}

const deleteSchema = z.object({ membershipId: z.cuid() });
export async function DELETE(request: Request) {
  try {
    const context = await requireSession("ADMIN");
    const input = await parseJson(request, deleteSchema);
    const membership = await manageableMembership(
      input.membershipId,
      context.organizationId,
    );
    if (membership.userId === context.user.id)
      throw new AppError(
        "You cannot remove your own active membership",
        "SELF_REMOVAL_FORBIDDEN",
        409,
      );
    if (!context.session.orgId)
      throw new AppError(
        "Clerk organization is not selected",
        "ORG_REQUIRED",
        409,
      );
    const clerk = await clerkClient();
    await clerk.organizations.deleteOrganizationMembership({
      organizationId: context.session.orgId,
      userId: membership.user.clerkId,
    });
    await db.membership.delete({ where: { id: membership.id } });
    await db.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorId: context.user.id,
        action: "team.member.remove",
        entityType: "membership",
        entityId: membership.id,
        before: { role: membership.role },
      },
    });
    return ok({ removed: true });
  } catch (error) {
    return routeError(error);
  }
}
const invitationSchema = z.object({
  email: z.email(),
  role: z.enum(["ADMIN", "EDITOR", "ANALYST", "VIEWER"]).default("EDITOR"),
});
export async function POST(request: Request) {
  try {
    const context = await requireSession("ADMIN");
    const input = await parseJson(request, invitationSchema);
    if (!context.session.orgId)
      throw new AppError(
        "Clerk organization is not selected",
        "ORG_REQUIRED",
        409,
      );
    const clerk = await clerkClient();
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: context.session.orgId,
      emailAddress: input.email,
      role: input.role === "ADMIN" ? "org:admin" : "org:member",
      inviterUserId: context.session.userId!,
      publicMetadata: { adforgeRole: input.role },
    });
    await db.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorId: context.user.id,
        action: "team.invite",
        entityType: "invitation",
        entityId: invitation.id,
        after: { email: input.email, role: input.role },
      },
    });
    return created({
      id: invitation.id,
      email: input.email,
      role: input.role,
      status: "pending",
    });
  } catch (error) {
    return routeError(error);
  }
}
