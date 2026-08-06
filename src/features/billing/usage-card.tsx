"use client";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
type Usage = {
  balance: number;
  records: Array<{
    metric: string;
    unit: string;
    _sum: { quantity: string | null };
  }>;
};
export function UsageCard() {
  const { data } = useQuery({
    queryKey: ["usage"],
    queryFn: () => api<Usage>("/api/v1/usage"),
  });
  return (
    <Card className="mb-5 border-[#f1d7cd] bg-gradient-to-r from-[#fff8f5] to-white">
      <CardContent className="flex items-center gap-4 pt-5">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#ff5a36] text-white">
          <Coins size={20} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-black">
            {data?.balance.toLocaleString() ?? "—"} credits available
          </p>
          <p className="text-xs text-[#7b808a]">
            Usage is transactionally metered; failed jobs refund automatically.
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-black">
            {data?.records.reduce(
              (sum, row) => sum + Number(row._sum.quantity ?? 0),
              0,
            ) ?? 0}
          </p>
          <p className="text-xs text-[#858994]">operations · 30 days</p>
        </div>
      </CardContent>
    </Card>
  );
}
