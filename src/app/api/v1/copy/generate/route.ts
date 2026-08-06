import { generateCopySchema } from "@/features/ai/schemas";
import { generateCopy } from "@/features/ai/service";
import { created, parseJson, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";

export async function POST(request: Request) {
  try {
    const context = await requirePrincipal(request, "EDITOR", "creative:write");
    await rateLimit(`copy:${context.user.id}`, 20, 60);
    const input = await parseJson(request, generateCopySchema);
    return created(
      await generateCopy({
        ...input,
        organizationId: context.organizationId,
        userId: context.user.id,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
