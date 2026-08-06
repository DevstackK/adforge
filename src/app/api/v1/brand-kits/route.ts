import { z } from "zod";
import { db } from "@/lib/db";
import { created, ok, parseJson, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { NotFoundError } from "@/lib/errors";
import { audit } from "@/server/audit";
const schema = z.object({
  name: z.string().min(2).max(100),
  colors: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  typography: z.object({ heading: z.string().min(1), body: z.string().min(1) }),
  voice: z
    .object({
      tone: z.array(z.string()),
      forbiddenTerms: z.array(z.string()),
      productClaims: z.array(z.string()),
    })
    .default({ tone: [], forbiddenTerms: [], productClaims: [] }),
  logoAssetId: z.cuid().optional(),
  isDefault: z.boolean().default(false),
});
export async function GET() {
  try {
    const { organizationId } = await requireSession();
    return ok(
      await db.brandKit.findMany({
        where: { organizationId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    const context = await requireSession("ADMIN");
    const { organizationId } = context;
    const input = await parseJson(request, schema);
    if (
      input.logoAssetId &&
      !(await db.asset.findFirst({
        where: {
          id: input.logoAssetId,
          organizationId,
          type: "LOGO",
        },
      }))
    )
      throw new NotFoundError("Logo asset");
    const kit = await db.$transaction(async (tx) => {
      if (input.isDefault)
        await tx.brandKit.updateMany({
          where: { organizationId },
          data: { isDefault: false },
        });
      return tx.brandKit.create({ data: { ...input, organizationId } });
    });
    await audit({
      organizationId,
      actorId: context.user.id,
      action: "brand_kit.create",
      entityType: "brand_kit",
      entityId: kit.id,
      after: { name: kit.name, isDefault: kit.isDefault },
    });
    return created(kit);
  } catch (error) {
    return routeError(error);
  }
}
