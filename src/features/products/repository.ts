import type { Prisma } from "@/generated/prisma/client";
import type { db as database } from "@/lib/db";

export type ImportedProduct = {
  name: string;
  description: string;
  imageUrls: string[];
  price?: string;
  currency: string;
  metadata: Prisma.InputJsonValue;
};

export interface ProductRepository {
  projectExists(projectId: string, organizationId: string): Promise<boolean>;
  upsertImported(
    projectId: string,
    sourceUrl: string,
    product: ImportedProduct,
  ): ReturnType<typeof database.product.upsert>;
}

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly client: typeof database) {}

  async projectExists(projectId: string, organizationId: string) {
    return Boolean(
      await this.client.project.findFirst({
        where: { id: projectId, organizationId, status: "ACTIVE" },
        select: { id: true },
      }),
    );
  }

  upsertImported(
    projectId: string,
    sourceUrl: string,
    product: ImportedProduct,
  ) {
    return this.client.product.upsert({
      where: { projectId_sourceUrl: { projectId, sourceUrl } },
      update: product,
      create: { projectId, sourceUrl, ...product },
    });
  }
}
