import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.TEST_DATABASE_URL;
const suite = connectionString ? describe : describe.skip;
let db: PrismaClient;

suite("tenant persistence", () => {
  beforeAll(() => {
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: connectionString! }),
    });
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("cascades organization-owned data without deleting the user", async () => {
    const suffix = crypto.randomUUID();
    const user = await db.user.create({
      data: {
        clerkId: `test_${suffix}`,
        email: `${suffix}@integration.adforge.local`,
      },
    });
    const organization = await db.organization.create({
      data: { name: "Integration Tenant", slug: `integration-${suffix}` },
    });
    await db.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
    });
    const project = await db.project.create({
      data: {
        organizationId: organization.id,
        createdById: user.id,
        name: "Cascade verification",
      },
    });
    const asset = await db.asset.create({
      data: {
        organizationId: organization.id,
        projectId: project.id,
        type: "IMAGE",
        name: "Integration creative",
        storageKey: `integration/${suffix}.png`,
        url: `s3://test/integration/${suffix}.png`,
        mimeType: "image/png",
        bytes: 128n,
      },
    });
    const campaign = await db.campaign.create({
      data: {
        organizationId: organization.id,
        projectId: project.id,
        createdById: user.id,
        platform: "META",
        name: "Integration campaign",
        objective: "TRAFFIC",
        dailyBudget: 25,
        audience: { locations: ["US"] },
        creatives: {
          create: {
            assetId: asset.id,
            externalId: `provider_ad_${suffix}`,
            copy: { headline: "Test" },
          },
        },
      },
      include: { creatives: true },
    });
    await db.creativeMetric.create({
      data: {
        creativeId: campaign.creatives[0]!.id,
        recordedAt: new Date(),
        impressions: 100n,
        clicks: 5n,
        spend: 10,
      },
    });
    await db.analyticsInsight.create({
      data: {
        organizationId: organization.id,
        fingerprint: suffix,
        model: "integration-model",
        recommendations: [{ title: "Measured recommendation" }],
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await db.organization.delete({ where: { id: organization.id } });
    expect(
      await db.project.count({ where: { organizationId: organization.id } }),
    ).toBe(0);
    expect(
      await db.analyticsInsight.count({
        where: { organizationId: organization.id },
      }),
    ).toBe(0);
    expect(await db.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    await db.user.delete({ where: { id: user.id } });
  });
});
