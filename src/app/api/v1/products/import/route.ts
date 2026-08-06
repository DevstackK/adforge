import { importProductSchema } from "@/features/products/schemas";
import { importProduct } from "@/features/products/service";
import { created, parseJson, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";

export async function POST(request: Request) {
  try {
    const context = await requirePrincipal(request, "EDITOR", "products:write");
    await rateLimit(`product-import:${context.user.id}`, 10, 60);
    const input = await parseJson(request, importProductSchema);
    const product = await importProduct({
      ...input,
      organizationId: context.organizationId,
    });
    await audit({
      organizationId: context.organizationId,
      actorId: context.user.id,
      action: "product.import",
      entityType: "product",
      entityId: product.id,
      after: { sourceUrl: product.sourceUrl, name: product.name },
    });
    return created(product);
  } catch (error) {
    return routeError(error);
  }
}
