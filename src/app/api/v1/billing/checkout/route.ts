import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { ok, parseJson, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { stripe } from "@/server/stripe";
import { audit } from "@/server/audit";
import { env } from "@/lib/env";

const schema = z.object({
  plan: z.enum(["STARTER", "GROWTH", "SCALE"]),
  seats: z.number().int().min(1).max(500).default(1),
});
export async function POST(request: Request) {
  try {
    const context = await requireSession("OWNER");
    const input = await parseJson(request, schema);
    const priceId = process.env[`STRIPE_PRICE_${input.plan}`];
    if (!priceId)
      throw new AppError(
        `${input.plan} price is not configured`,
        "BILLING_NOT_CONFIGURED",
        503,
      );
    const organization = await db.organization.findUniqueOrThrow({
      where: { id: context.organizationId },
    });
    const existing = await db.subscription.findFirst({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
    });
    const customerId =
      existing?.stripeCustomerId ??
      (
        await stripe().customers.create(
          {
            name: organization.name,
            metadata: { organizationId: organization.id },
          },
          { idempotencyKey: `customer-${organization.id}` },
        )
      ).id;
    const session = await stripe().checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: input.seats }],
        subscription_data: {
          metadata: { organizationId: organization.id, plan: input.plan },
        },
        success_url: `${env().APP_URL}/settings?billing=success`,
        cancel_url: `${env().APP_URL}/settings?billing=cancelled`,
        allow_promotion_codes: true,
        client_reference_id: organization.id,
      },
      {
        idempotencyKey: `checkout-${organization.id}-${input.plan}-${Date.now()}`,
      },
    );
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "billing.checkout.create",
      entityType: "stripe_checkout_session",
      entityId: session.id,
      metadata: { plan: input.plan, seats: input.seats },
    });
    return ok({ checkoutUrl: session.url });
  } catch (error) {
    return routeError(error);
  }
}
