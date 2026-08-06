import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { ok, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { stripe } from "@/server/stripe";
import { audit } from "@/server/audit";
import { env } from "@/lib/env";
export async function POST() {
  try {
    const context = await requireSession("OWNER");
    const { organizationId } = context;
    const subscription = await db.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription)
      throw new AppError(
        "No billing account exists for this organization",
        "BILLING_ACCOUNT_NOT_FOUND",
        404,
      );
    const session = await stripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${env().APP_URL}/settings`,
    });
    await audit({
      organizationId,
      actorId: context.user.id,
      action: "billing.portal.create",
      entityType: "stripe_billing_session",
      entityId: session.id,
    });
    return ok({ portalUrl: session.url });
  } catch (error) {
    return routeError(error);
  }
}
