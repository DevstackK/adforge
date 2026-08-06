import "server-only";
import { db } from "@/lib/db";
import { PrismaProductRepository } from "@/features/products/repository";
import { PrismaCampaignRepository } from "@/features/campaigns/repository";

export const repositories = Object.freeze({
  products: new PrismaProductRepository(db),
  campaigns: new PrismaCampaignRepository(db),
});
