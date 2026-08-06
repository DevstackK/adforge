import { Webhook } from "svix";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { routeError } from "@/lib/http";
import { slugify } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";

type ClerkEvent = { type: string; data: Record<string, unknown> };
export async function POST(request: Request) {
  try {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret)
      throw new AppError(
        "Clerk webhook is not configured",
        "AUTH_NOT_CONFIGURED",
        503,
      );
    const id = request.headers.get("svix-id"),
      timestamp = request.headers.get("svix-timestamp"),
      signature = request.headers.get("svix-signature");
    if (!id || !timestamp || !signature)
      throw new AppError("Invalid webhook headers", "INVALID_SIGNATURE", 401);
    const event = new Webhook(secret).verify(await request.text(), {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as ClerkEvent;
    const data = event.data;
    if (["user.created", "user.updated"].includes(event.type)) {
      const emails = data.email_addresses as Array<{
        id: string;
        email_address: string;
      }>;
      const primary =
        emails.find((entry) => entry.id === data.primary_email_address_id)
          ?.email_address ?? emails[0]?.email_address;
      if (primary)
        await db.user.upsert({
          where: { clerkId: String(data.id) },
          update: {
            email: primary,
            name:
              [data.first_name, data.last_name].filter(Boolean).join(" ") ||
              null,
            avatarUrl: String(data.image_url ?? "") || null,
          },
          create: {
            clerkId: String(data.id),
            email: primary,
            name:
              [data.first_name, data.last_name].filter(Boolean).join(" ") ||
              null,
            avatarUrl: String(data.image_url ?? "") || null,
          },
        });
    } else if (event.type === "user.deleted") {
      await db.user.deleteMany({ where: { clerkId: String(data.id) } });
    } else if (
      ["organization.created", "organization.updated"].includes(event.type)
    ) {
      const name = String(data.name);
      await db.organization.upsert({
        where: { clerkOrgId: String(data.id) },
        update: { name, slug: String(data.slug ?? slugify(name)) },
        create: {
          clerkOrgId: String(data.id),
          name,
          slug: String(
            data.slug ?? `${slugify(name)}-${String(data.id).slice(-6)}`,
          ),
        },
      });
    } else if (
      [
        "organizationMembership.created",
        "organizationMembership.updated",
      ].includes(event.type)
    ) {
      const publicUserData = data.public_user_data as { user_id: string };
      const organization = data.organization as { id: string };
      const [user, org] = await Promise.all([
        db.user.findUnique({ where: { clerkId: publicUserData.user_id } }),
        db.organization.findUnique({ where: { clerkOrgId: organization.id } }),
      ]);
      if (!user || !org)
        throw new AppError(
          "Webhook dependency has not arrived",
          "WEBHOOK_ORDERING",
          409,
        );
      const clerkRole = String(data.role).replace("org:", "").toUpperCase();
      const metadata = (data.public_metadata ?? {}) as {
        adforgeRole?: string;
      };
      const metadataRole = metadata.adforgeRole?.toUpperCase();
      const role: Role =
        metadataRole &&
        ["OWNER", "ADMIN", "EDITOR", "ANALYST", "VIEWER"].includes(metadataRole)
          ? (metadataRole as Role)
          : clerkRole === "MEMBER"
            ? "EDITOR"
            : ["OWNER", "ADMIN", "EDITOR", "ANALYST", "VIEWER"].includes(
                  clerkRole,
                )
              ? (clerkRole as Role)
              : "VIEWER";
      await db.membership.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: org.id },
        },
        update: { role },
        create: { userId: user.id, organizationId: org.id, role },
      });
    } else if (event.type === "organizationMembership.deleted") {
      const publicUserData = data.public_user_data as { user_id: string };
      const organization = data.organization as { id: string };
      const [user, org] = await Promise.all([
        db.user.findUnique({ where: { clerkId: publicUserData.user_id } }),
        db.organization.findUnique({ where: { clerkOrgId: organization.id } }),
      ]);
      if (user && org)
        await db.membership.deleteMany({
          where: { userId: user.id, organizationId: org.id },
        });
    }
    return Response.json({ received: true });
  } catch (error) {
    return routeError(error);
  }
}
