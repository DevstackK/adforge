import { generateMediaSchema } from "@/features/ai/schemas";
import { enqueueMedia } from "@/features/ai/service";
import { created, parseJson, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";

export async function POST(request: Request) {
  try {
    const context = await requirePrincipal(request, "EDITOR", "creative:write");
    await rateLimit(`media:${context.user.id}`, 10, 60);
    const input = await parseJson(request, generateMediaSchema);
    return created(
      await enqueueMedia({
        ...input,
        organizationId: context.organizationId,
        userId: context.user.id,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
