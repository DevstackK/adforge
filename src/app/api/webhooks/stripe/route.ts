import type Stripe from "stripe";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { routeError } from "@/lib/http";
import { recordCredits } from "@/server/credits";
import { stripe } from "@/server/stripe";

const statusMap = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELLED",
  unpaid: "UNPAID",
  paused: "PAUSED",
  incomplete: "UNPAID",
  incomplete_expired: "CANCELLED",
} as const;
const planCredits: Record<string, number> = {
  STARTER: 250,
  GROWTH: 1000,
  SCALE: 5000,
};

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
      throw new AppError("Invalid webhook signature", "INVALID_SIGNATURE", 401);
    const event = stripe().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    const existing = await db.auditLog.findFirst({
      where: { action: "stripe.webhook", entityId: event.id },
    });
    if (existing) return Response.json({ received: true, duplicate: true });
    if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata.organizationId;
      const plan = subscription.metadata.plan ?? "STARTER";
      if (organizationId)
        await db.subscription.upsert({
          where: { stripeSubscriptionId: subscription.id },
          update: {
            plan,
            status: statusMap[subscription.status],
            seats: subscription.items.data[0]?.quantity ?? 1,
            currentPeriodStart: new Date(
              subscription.items.data[0]?.current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(
              subscription.items.data[0]?.current_period_end * 1000,
            ),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
          create: {
            organizationId,
            stripeCustomerId: String(subscription.customer),
            stripeSubscriptionId: subscription.id,
            plan,
            status: statusMap[subscription.status],
            seats: subscription.items.data[0]?.quantity ?? 1,
            currentPeriodStart: new Date(
              subscription.items.data[0]?.current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(
              subscription.items.data[0]?.current_period_end * 1000,
            ),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
        });
    }
    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = String(invoice.customer);
      const subscription = await db.subscription.findUnique({
        where: { stripeCustomerId: customerId },
      });
      if (subscription) {
        await db.invoice.upsert({
          where: { stripeInvoiceId: invoice.id },
          update: {
            amountDue: invoice.amount_due / 100,
            amountPaid: invoice.amount_paid / 100,
            status: invoice.status ?? "unknown",
            hostedUrl: invoice.hosted_invoice_url ?? null,
            paidAt: invoice.status_transitions.paid_at
              ? new Date(invoice.status_transitions.paid_at * 1000)
              : null,
          },
          create: {
            organizationId: subscription.organizationId,
            stripeInvoiceId: invoice.id!,
            amountDue: invoice.amount_due / 100,
            amountPaid: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            status: invoice.status ?? "unknown",
            hostedUrl: invoice.hosted_invoice_url ?? null,
            dueAt: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
            paidAt: invoice.status_transitions.paid_at
              ? new Date(invoice.status_transitions.paid_at * 1000)
              : null,
          },
        });
        if (
          event.type === "invoice.paid" &&
          invoice.billing_reason === "subscription_cycle"
        )
          await recordCredits({
            organizationId: subscription.organizationId,
            amount: planCredits[subscription.plan] ?? 250,
            type: "GRANT",
            description: `${subscription.plan} monthly credits`,
            referenceId: invoice.id,
          });
      }
    }
    await db.auditLog.create({
      data: {
        action: "stripe.webhook",
        entityType: event.type,
        entityId: event.id,
        metadata: { livemode: event.livemode },
      },
    });
    return Response.json({ received: true });
  } catch (error) {
    return routeError(error);
  }
}
