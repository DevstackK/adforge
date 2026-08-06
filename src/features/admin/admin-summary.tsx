"use client";
import { useQuery } from "@tanstack/react-query";
import { Building2, CircleDollarSign, LifeBuoy, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
type Summary = {
  users: number;
  organizations: number;
  activeSubscriptions: number;
  openTickets: number;
  revenue: number;
};
export function AdminSummary() {
  const { data, error } = useQuery({
    queryKey: ["admin-summary"],
    queryFn: () => api<Summary>("/api/v1/admin/summary"),
    retry: false,
  });
  if (error)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error.message}
      </div>
    );
  const metrics = [
    ["Users", data?.users ?? 0, Users],
    ["Organizations", data?.organizations ?? 0, Building2],
    ["Active subscriptions", data?.activeSubscriptions ?? 0, CircleDollarSign],
    ["Open tickets", data?.openTickets ?? 0, LifeBuoy],
  ] as const;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <Icon className="text-[#ff5a36]" size={19} />
              <p className="mt-6 text-3xl font-black">{value}</p>
              <p className="text-sm text-[#777c86]">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <CardContent className="pt-5">
          <p className="text-sm font-bold text-[#747984]">
            Lifetime collected revenue
          </p>
          <p className="mt-2 text-4xl font-black">
            {formatCurrency(data?.revenue ?? 0)}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
