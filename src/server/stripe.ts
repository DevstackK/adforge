import Stripe from "stripe";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

let instance: Stripe | undefined;
export function stripe() {
  const secretKey = env().STRIPE_SECRET_KEY;
  if (!secretKey)
    throw new AppError(
      "Stripe is not configured",
      "BILLING_NOT_CONFIGURED",
      503,
    );
  return (instance ??= new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
    appInfo: { name: "AdForge AI", version: "1.0.0" },
  }));
}
