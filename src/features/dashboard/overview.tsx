"use client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CircleDollarSign,
  Eye,
  MousePointerClick,
  BadgeDollarSign,
  ChartNoAxesCombined,
  Sparkles,
  Target,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Analytics = {
  totals: {
    spend: number;
    revenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpa: number;
    roas: number;
  };
  campaigns: Array<{
    id: string;
    name: string;
    platform: string;
    spend: number;
    revenue: number;
    roas: number;
    ctr: number;
  }>;
  topCreatives: Array<{
    id: string;
    campaignName: string;
    asset: { name: string; type: string };
    impressions: number;
    ctr: number;
    roas: number;
  }>;
  recommendations: Array<{
    priority: string;
    category: string;
    title: string;
    rationale: string;
    action: string;
  }>;
  recommendationsSource: "AI" | "AI_CACHE" | "RULES";
};
const empty: Analytics = {
  totals: {
    spend: 0,
    revenue: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    cpa: 0,
    roas: 0,
  },
  campaigns: [],
  topCreatives: [],
  recommendations: [],
  recommendationsSource: "RULES",
};
export function Overview() {
  const { data = empty, isLoading } = useQuery({
    queryKey: ["analytics", 30],
    queryFn: () => api<Analytics>("/api/v1/analytics?days=30"),
  });
  const metrics = [
    [
      "Spend",
      formatCurrency(data.totals.spend),
      CircleDollarSign,
      "Last 30 days",
    ],
    [
      "ROAS",
      `${data.totals.roas.toFixed(2)}×`,
      ArrowUpRight,
      "Revenue / spend",
    ],
    [
      "Impressions",
      data.totals.impressions.toLocaleString(),
      Eye,
      "Paid reach",
    ],
    [
      "CTR",
      `${(data.totals.ctr * 100).toFixed(2)}%`,
      MousePointerClick,
      "Click-through rate",
    ],
    [
      "Clicks",
      data.totals.clicks.toLocaleString(),
      MousePointerClick,
      "Paid visits",
    ],
    [
      "Conversions",
      data.totals.conversions.toLocaleString(),
      Target,
      "Attributed outcomes",
    ],
    [
      "CPA",
      formatCurrency(data.totals.cpa),
      BadgeDollarSign,
      "Spend / conversion",
    ],
    [
      "Revenue",
      formatCurrency(data.totals.revenue),
      ChartNoAxesCombined,
      "Attributed value",
    ],
  ] as const;
  return (
    <>
      {
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value, Icon, note]) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#6b707b]">
                    {label}
                  </span>
                  <span className="grid size-9 place-items-center rounded-xl bg-[#fff0ec] text-[#f05230]">
                    <Icon size={17} />
                  </span>
                </div>
                <p className="mt-5 text-3xl font-black tracking-[-.04em]">
                  {isLoading ? "—" : value}
                </p>
                <p className="mt-1 text-xs text-[#8b8f98]">{note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      }
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-black">Campaign performance</h2>
              <p className="text-xs text-[#81858e]">
                Ranked by return on ad spend
              </p>
            </div>
            <Badge>30 days</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-5 rounded-xl border border-[#ececef] p-3"
                >
                  <div>
                    <p className="text-sm font-bold">{campaign.name}</p>
                    <p className="text-xs text-[#8a8e97]">
                      {campaign.platform}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {campaign.roas.toFixed(2)}×
                    </p>
                    <p className="text-[11px] text-[#8a8e97]">ROAS</p>
                  </div>
                  <div className="w-20">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#efeff2]">
                      <div
                        className="h-full rounded-full forge-gradient"
                        style={{
                          width: `${Math.min(100, campaign.roas * 20)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {!data.campaigns.length && (
                <Empty text="Performance appears after your first campaign sync." />
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <div className="forge-gradient p-6 text-white">
            <div className="flex items-center justify-between">
              <Sparkles size={22} />
              <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-black">
                {data.recommendationsSource.startsWith("AI")
                  ? "AI · GROUNDED"
                  : "RULE ENGINE"}
              </span>
            </div>
            <h2 className="mt-7 text-2xl font-black tracking-[-.035em]">
              Forge signal
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/80">
              {data.recommendations[0]?.rationale ??
                "Launch at least three creative variants per audience so AdForge can identify meaningful performance patterns."}
            </p>
          </div>
          <CardContent>
            <div className="flex items-center gap-3 rounded-xl bg-[#f5f3ff] p-4">
              <Target className="text-[#7356db]" size={20} />
              <div>
                <p className="text-sm font-bold">Next best action</p>
                <p className="text-xs text-[#777b86]">
                  {data.recommendations[0]?.action ??
                    "Create a fresh hook variation"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader>
          <div>
            <h2 className="font-black">Top creatives</h2>
            <p className="text-xs text-[#81858e]">
              Provider-attributed ad performance ranked by ROAS and CTR
            </p>
          </div>
          <Badge>{data.topCreatives.length} measured</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.topCreatives.slice(0, 6).map((creative, index) => (
              <div
                key={creative.id}
                className="rounded-xl border border-[#ececef] p-4"
              >
                <div className="flex items-center justify-between">
                  <Badge>#{index + 1}</Badge>
                  <span className="text-xs font-bold text-[#777b86]">
                    {creative.asset.type}
                  </span>
                </div>
                <p className="mt-4 truncate text-sm font-black">
                  {creative.asset.name}
                </p>
                <p className="truncate text-xs text-[#858a94]">
                  {creative.campaignName}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="ROAS" value={`${creative.roas.toFixed(2)}×`} />
                  <Stat
                    label="CTR"
                    value={`${(creative.ctr * 100).toFixed(2)}%`}
                  />
                  <Stat
                    label="Views"
                    value={creative.impressions.toLocaleString()}
                  />
                </div>
              </div>
            ))}
            {!data.topCreatives.length && (
              <div className="md:col-span-2 xl:col-span-3">
                <Empty text="Creative rankings appear after the first provider metric sync." />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f5f5f7] p-2">
      <p className="font-black">{value}</p>
      <p className="text-[10px] text-[#858a94]">{label}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-[#d9dbe0] text-center text-sm text-[#848892]">
      {text}
    </div>
  );
}
