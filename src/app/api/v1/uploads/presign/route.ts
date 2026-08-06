import { z } from "zod";
import { created, parseJson, routeError } from "@/lib/http";
import { requireSession } from "@/server/auth";
import { createUploadUrl } from "@/server/storage";

const schema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/),
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "audio/mpeg",
    "audio/wav",
    "font/woff2",
  ]),
  bytes: z.number().int().positive().max(500_000_000),
});
export async function POST(request: Request) {
  try {
    const context = await requireSession("EDITOR");
    const input = await parseJson(request, schema);
    const key = `organizations/${context.organizationId}/uploads/${crypto.randomUUID()}-${input.filename}`;
    return created({
      key,
      uploadUrl: await createUploadUrl(key, input.contentType, input.bytes),
      expiresIn: 300,
    });
  } catch (error) {
    return routeError(error);
  }
}
