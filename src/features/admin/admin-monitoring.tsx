"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Database, RadioTower, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";

type Monitoring = {
  status: "healthy" | "degraded";
  database: { status: string; latencyMs: number };
  queues:
    | {
        status: "up";
        generations: Record<string, number>;
        campaigns: Record<string, number>;
      }
    | { status: "down"; error: string };
  failures24h: { generations: number; campaigns: number };
  unhealthyConnections: number;
  checkedAt: string;
};

export function AdminMonitoring() {
  const { data, error } = useQuery({
    queryKey: ["admin-monitoring"],
    queryFn: () => api<Monitoring>("/api/v1/admin/monitoring"),
    refetchInterval: 30_000,
    retry: false,
  });
  if (error) return null;
  const queueBacklog =
    data?.queues.status === "up"
      ? (data.queues.generations.waiting ?? 0) +
        (data.queues.generations.delayed ?? 0) +
        (data.queues.campaigns.waiting ?? 0) +
        (data.queues.campaigns.delayed ?? 0)
      : 0;
  const items = [
    {
      label: "Database",
      value: data ? `${data.database.latencyMs} ms` : "—",
      note: data?.database.status ?? "checking",
      icon: Database,
    },
    {
      label: "Job queues",
      value: data?.queues.status === "down" ? "DOWN" : String(queueBacklog),
      note:
        data?.queues.status === "down"
          ? "Redis unavailable"
          : "waiting or delayed",
      icon: RadioTower,
    },
    {
      label: "Failures · 24h",
      value: String(
        (data?.failures24h.generations ?? 0) +
          (data?.failures24h.campaigns ?? 0),
      ),
      note: "generation + campaign",
      icon: TriangleAlert,
    },
    {
      label: "Ad connections",
      value: String(data?.unhealthyConnections ?? 0),
      note: "expired, revoked, or errored",
      icon: Activity,
    },
  ];
  return (
    <section className="mt-5" aria-labelledby="operations-health">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="operations-health" className="font-black">
          Operations health
        </h2>
        <span
          className={`text-xs font-black uppercase ${data?.status === "degraded" ? "text-amber-700" : "text-emerald-700"}`}
        >
          {data?.status ?? "checking"}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(({ label, value, note, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#747984]">{label}</p>
                <Icon size={17} className="text-[#7457e8]" />
              </div>
              <p className="mt-4 text-2xl font-black">{value}</p>
              <p className="text-xs text-[#858994]">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
