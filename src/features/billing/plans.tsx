"use client";
import { useMutation } from "@tanstack/react-query";
import { Check, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
const plans = [
  {
    id: "STARTER",
    name: "Starter",
    price: "$49",
    credits: "250 credits",
    features: ["3 team members", "AI copy and images", "Campaign analytics"],
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: "$149",
    credits: "1,000 credits",
    features: ["10 team members", "AI video workflows", "All ad connections"],
  },
  {
    id: "SCALE",
    name: "Scale",
    price: "$499",
    credits: "5,000 credits",
    features: ["50 team members", "Priority rendering", "Advanced governance"],
  },
] as const;
export function Plans() {
  const checkout = useMutation({
    mutationFn: (plan: string) =>
      api<{ checkoutUrl: string }>("/api/v1/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan, seats: 1 }),
      }),
    onSuccess: (data) => {
      window.location.assign(data.checkoutUrl);
    },
  });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {plans.map((plan, index) => (
        <Card
          key={plan.id}
          className={index === 1 ? "ring-2 ring-[#ff5a36]" : ""}
        >
          <CardContent className="pt-6">
            <p className="text-sm font-black text-[#6b707b]">{plan.name}</p>
            <p className="mt-3 text-4xl font-black tracking-[-.05em]">
              {plan.price}
              <span className="text-sm font-medium text-[#858994]">
                {" "}
                / month
              </span>
            </p>
            <p className="mt-2 text-sm font-bold text-[#e54b2a]">
              {plan.credits}
            </p>
            <ul className="my-6 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check size={16} className="text-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant={index === 1 ? "primary" : "secondary"}
              className="w-full"
              onClick={() => checkout.mutate(plan.id)}
              disabled={checkout.isPending}
            >
              {checkout.isPending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                "Choose plan"
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
export function BillingPortal() {
  const portal = useMutation({
    mutationFn: () =>
      api<{ portalUrl: string }>("/api/v1/billing/portal", { method: "POST" }),
    onSuccess: (data) => window.location.assign(data.portalUrl),
  });
  return (
    <div className="mb-5 flex items-center justify-between rounded-2xl border border-[#e2e3e7] bg-white p-4">
      <div>
        <p className="text-sm font-black">Existing subscription</p>
        <p className="text-xs text-[#7d828c]">
          Invoices, payment method, seat quantity and cancellation are managed
          in Stripe.
        </p>
      </div>
      <Button
        variant="secondary"
        onClick={() => portal.mutate()}
        disabled={portal.isPending}
      >
        Open billing portal
      </Button>
    </div>
  );
}
