import { z } from "zod";
import { requireSession } from "@/server/auth";
import { db } from "@/lib/db";
import { ok, routeError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireSession("VIEWER");
    const query = z
      .string()
      .trim()
      .min(2)
      .max(100)
      .parse(new URL(request.url).searchParams.get("q"));
    const contains = { contains: query, mode: "insensitive" as const };
    const [projects, products, campaigns, assets] = await Promise.all([
      db.project.findMany({
        where: {
          organizationId,
          OR: [{ name: contains }, { description: contains }],
        },
        select: { id: true, name: true, status: true },
        take: 5,
      }),
      db.product.findMany({
        where: {
          project: { organizationId },
          OR: [{ name: contains }, { description: contains }],
        },
        select: { id: true, name: true, projectId: true },
        take: 5,
      }),
      db.campaign.findMany({
        where: { organizationId, name: contains },
        select: { id: true, name: true, platform: true, status: true },
        take: 5,
      }),
      db.asset.findMany({
        where: { organizationId, name: contains },
        select: { id: true, name: true, type: true },
        take: 5,
      }),
    ]);
    return ok([
      ...projects.map((item) => ({
        ...item,
        kind: "project",
        href: "/products",
      })),
      ...products.map((item) => ({
        ...item,
        kind: "product",
        href: "/products",
      })),
      ...campaigns.map((item) => ({
        ...item,
        kind: "campaign",
        href: "/campaigns",
      })),
      ...assets.map((item) => ({
        ...item,
        kind: "asset",
        href: item.type === "VIDEO" ? "/video-studio" : "/image-studio",
      })),
    ]);
  } catch (error) {
    return routeError(error);
  }
}
