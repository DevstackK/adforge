import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required to seed the database");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const owner = await db.user.upsert({
    where: { email: "owner@adforge.local" },
    update: { name: "AdForge Owner" },
    create: {
      clerkId: process.env.SEED_CLERK_USER_ID ?? "user_adforge_seed_owner",
      email: "owner@adforge.local",
      name: "AdForge Owner",
      isPlatformAdmin: true,
    },
  });
  const organization = await db.organization.upsert({
    where: { slug: "acme-outdoors" },
    update: {},
    create: {
      name: "Acme Outdoors",
      slug: "acme-outdoors",
      settings: { currency: "USD", reportingTimezone: "America/New_York" },
    },
  });
  await db.membership.upsert({
    where: {
      userId_organizationId: {
        userId: owner.id,
        organizationId: organization.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      userId: owner.id,
      organizationId: organization.id,
      role: "OWNER",
    },
  });
  const project = await db.project.upsert({
    where: { id: "project_launch_trailpack" },
    update: {},
    create: {
      id: "project_launch_trailpack",
      organizationId: organization.id,
      createdById: owner.id,
      name: "TrailPack Launch",
      description:
        "Spring launch campaign for the modular commuter-to-trail backpack.",
    },
  });
  await db.product.upsert({
    where: {
      projectId_sourceUrl: {
        projectId: project.id,
        sourceUrl: "https://example.com/trailpack",
      },
    },
    update: {},
    create: {
      projectId: project.id,
      sourceUrl: "https://example.com/trailpack",
      name: "TrailPack 24",
      description:
        "A weather-resistant 24 litre modular backpack designed for commutes and day hikes, backed by a lifetime repair guarantee.",
      price: 129,
      currency: "USD",
      imageUrls: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62"],
      metadata: { sku: "TP24-SLATE", category: "Bags" },
    },
  });
  await db.brandKit.upsert({
    where: { id: "brand_acme_master" },
    update: {},
    create: {
      id: "brand_acme_master",
      organizationId: organization.id,
      name: "Acme Master",
      isDefault: true,
      colors: { primary: "#E95D3F", secondary: "#15251D", accent: "#E7C15B" },
      typography: { heading: "Inter", body: "Inter" },
      voice: {
        tone: ["capable", "warm", "direct"],
        forbiddenTerms: ["indestructible"],
        productClaims: ["weather-resistant", "lifetime repair guarantee"],
      },
    },
  });
  const latest = await db.creditTransaction.findFirst({
    where: { organizationId: organization.id },
  });
  if (!latest)
    await db.creditTransaction.create({
      data: {
        organizationId: organization.id,
        type: "GRANT",
        amount: 1000,
        balanceAfter: 1000,
        description: "Growth plan initial allowance",
      },
    });
  await Promise.all([
    db.featureFlag.upsert({
      where: { key: "talking-avatar" },
      update: {},
      create: {
        key: "talking-avatar",
        description: "Enable talking avatar video workflow",
        enabled: true,
      },
    }),
    db.featureFlag.upsert({
      where: { key: "linkedin-publishing" },
      update: {},
      create: {
        key: "linkedin-publishing",
        description: "Enable LinkedIn campaign publishing",
        enabled: false,
      },
    }),
  ]);
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
