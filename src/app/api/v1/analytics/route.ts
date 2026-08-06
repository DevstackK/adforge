import { db } from "@/lib/db";
import { ok, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
import OpenAI from "openai";
import { z } from "zod";
import { sha256 } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/generated/prisma/client";

const recommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
        category: z.enum(["CREATIVE", "CONVERSION", "ECONOMICS", "AUDIENCE"]),
        title: z.string().min(3).max(100),
        rationale: z.string().min(10).max(500),
        action: z.string().min(5).max(300),
      }),
    )
    .min(1)
    .max(4),
});

export async function GET(request: Request) {
  try {
    const { organizationId } = await requirePrincipal(
      request,
      "ANALYST",
      "analytics:read",
    );
    const url = new URL(request.url);
    const days = Math.min(
      365,
      Math.max(1, Number(url.searchParams.get("days") ?? 30)),
    );
    const since = new Date(Date.now() - days * 86_400_000);
    const campaigns = await db.campaign.findMany({
      where: { organizationId },
      include: {
        metrics: { where: { recordedAt: { gte: since } } },
        creatives: {
          include: {
            asset: { select: { id: true, name: true, type: true } },
            metrics: { where: { recordedAt: { gte: since } } },
          },
        },
      },
    });
    const totals = campaigns.reduce(
      (sum, campaign) =>
        campaign.metrics.reduce(
          (value, metric) => ({
            impressions: value.impressions + Number(metric.impressions),
            clicks: value.clicks + Number(metric.clicks),
            conversions: value.conversions + Number(metric.conversions),
            spend: value.spend + Number(metric.spend),
            revenue: value.revenue + Number(metric.revenue),
          }),
          sum,
        ),
      { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 },
    );
    const performance = campaigns
      .map((campaign) => {
        const values = campaign.metrics.reduce(
          (sum, metric) => ({
            impressions: sum.impressions + Number(metric.impressions),
            clicks: sum.clicks + Number(metric.clicks),
            conversions: sum.conversions + Number(metric.conversions),
            spend: sum.spend + Number(metric.spend),
            revenue: sum.revenue + Number(metric.revenue),
          }),
          { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 },
        );
        return {
          id: campaign.id,
          name: campaign.name,
          platform: campaign.platform,
          ...values,
          ctr: values.impressions ? values.clicks / values.impressions : 0,
          cpa: values.conversions ? values.spend / values.conversions : 0,
          roas: values.spend ? values.revenue / values.spend : 0,
        };
      })
      .sort((a, b) => b.roas - a.roas);
    const topCreatives = campaigns
      .flatMap((campaign) =>
        campaign.creatives.map((creative) => {
          const values = creative.metrics.reduce(
            (sum, metric) => ({
              impressions: sum.impressions + Number(metric.impressions),
              clicks: sum.clicks + Number(metric.clicks),
              conversions: sum.conversions + Number(metric.conversions),
              spend: sum.spend + Number(metric.spend),
              revenue: sum.revenue + Number(metric.revenue),
            }),
            { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 },
          );
          return {
            id: creative.id,
            campaignId: campaign.id,
            campaignName: campaign.name,
            asset: creative.asset,
            ...values,
            ctr: values.impressions ? values.clicks / values.impressions : 0,
            roas: values.spend ? values.revenue / values.spend : 0,
          };
        }),
      )
      .filter((creative) => creative.impressions > 0)
      .sort((a, b) => b.roas - a.roas || b.ctr - a.ctr)
      .slice(0, 10);
    const ctr = totals.impressions ? totals.clicks / totals.impressions : 0;
    const roas = totals.spend ? totals.revenue / totals.spend : 0;
    let recommendations = [
      ctr < 0.01
        ? {
            priority: "HIGH",
            category: "CREATIVE",
            title: "Refresh opening hooks",
            rationale: `Portfolio CTR is ${(ctr * 100).toFixed(2)}%, so the largest leverage is earning more first attention.`,
            action: "Generate three audience-specific hook variants.",
          }
        : {
            priority: "MEDIUM",
            category: "CONVERSION",
            title: "Preserve winning hooks and test offers",
            rationale: `Portfolio CTR is ${(ctr * 100).toFixed(2)}%; focus the next test below the click.`,
            action:
              "Hold the leading creative constant and vary offer framing.",
          },
      roas < 1 && totals.spend > 0
        ? {
            priority: "HIGH",
            category: "ECONOMICS",
            title: "Protect inefficient spend",
            rationale: `Portfolio ROAS is ${roas.toFixed(2)}×.`,
            action:
              "Pause low-return ad groups and reallocate only after conversion tracking is verified.",
          }
        : null,
    ].filter(Boolean);
    let recommendationsSource = "RULES";
    if (process.env.OPENAI_API_KEY && totals.impressions > 0) {
      const evidence = {
        days,
        totals: { ...totals, ctr, roas },
        campaigns: performance.slice(0, 15),
        creatives: topCreatives.slice(0, 10).map(({ asset, ...creative }) => ({
          ...creative,
          assetName: asset.name,
          assetType: asset.type,
        })),
      };
      const fingerprint = sha256(JSON.stringify(evidence));
      try {
        const cached = await db.analyticsInsight.findUnique({
          where: {
            organizationId_fingerprint: { organizationId, fingerprint },
          },
        });
        if (cached && cached.expiresAt > new Date()) {
          recommendations = recommendationSchema.parse({
            recommendations: cached.recommendations,
          }).recommendations;
          recommendationsSource = "AI_CACHE";
        } else {
          const model = process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini";
          const response = await new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 45_000,
            maxRetries: 1,
          }).responses.create({
            model,
            input: [
              {
                role: "developer",
                content:
                  'You are a paid-media analyst. Return JSON only as {"recommendations":[...]}. Every recommendation must cite exact supplied metrics in its rationale. Never infer demographics, attribution, causality, or statistical significance not present in the evidence. Prefer a controlled experiment with a measurable success condition.',
              },
              { role: "user", content: JSON.stringify(evidence) },
            ],
            text: { format: { type: "json_object" } },
          });
          const parsed = recommendationSchema.parse(
            JSON.parse(response.output_text),
          );
          recommendations = parsed.recommendations;
          recommendationsSource = "AI";
          await db.$transaction([
            db.analyticsInsight.upsert({
              where: {
                organizationId_fingerprint: { organizationId, fingerprint },
              },
              update: {
                model,
                recommendations:
                  parsed.recommendations as Prisma.InputJsonValue,
                expiresAt: new Date(Date.now() + 6 * 60 * 60_000),
              },
              create: {
                organizationId,
                fingerprint,
                model,
                recommendations:
                  parsed.recommendations as Prisma.InputJsonValue,
                expiresAt: new Date(Date.now() + 6 * 60 * 60_000),
              },
            }),
            db.usageRecord.create({
              data: {
                organizationId,
                metric: "analytics_recommendation",
                quantity: 1,
                unit: "analysis",
                metadata: { model, fingerprint },
              },
            }),
          ]);
        }
      } catch (error) {
        logger.warn(
          { error, organizationId },
          "AI analytics recommendation failed; using deterministic fallback",
        );
      }
    }
    return ok({
      range: { days, since },
      totals: {
        ...totals,
        ctr,
        cpa: totals.conversions ? totals.spend / totals.conversions : 0,
        roas,
      },
      campaigns: performance,
      topCreatives,
      recommendations,
      recommendationsSource,
    });
  } catch (error) {
    return routeError(error);
  }
}
