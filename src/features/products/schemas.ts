import { z } from "zod";

export const importProductSchema = z.object({
  projectId: z.cuid(),
  url: z
    .url()
    .refine(
      (url) => ["http:", "https:"].includes(new URL(url).protocol),
      "Only HTTP(S) URLs are supported",
    ),
});
