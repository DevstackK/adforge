import { z } from "zod";

export const campaignSchema = z
  .object({
    projectId: z.cuid(),
    productId: z.cuid().optional(),
    brandKitId: z.cuid().optional(),
    adConnectionId: z.cuid().optional(),
    platform: z.enum(["META", "GOOGLE", "TIKTOK", "PINTEREST", "LINKEDIN"]),
    name: z.string().min(3).max(160),
    objective: z.string().min(2).max(80),
    dailyBudget: z.number().positive().max(1_000_000),
    lifetimeBudget: z.number().positive().max(100_000_000).optional(),
    currency: z
      .string()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default("USD"),
    audience: z
      .object({
        locations: z.array(z.string()).min(1),
        ageMin: z.number().int().min(13).max(65).default(18),
        ageMax: z.number().int().min(13).max(65).default(65),
        genders: z.array(z.string()).default([]),
        interests: z.array(z.string()).max(100).default([]),
        languages: z.array(z.string()).default([]),
      })
      .refine(
        (value) => value.ageMax >= value.ageMin,
        "Maximum age must be at least minimum age",
      ),
    schedule: z
      .object({
        startAt: z.iso.datetime().optional(),
        endAt: z.iso.datetime().optional(),
        timezone: z.string().default("UTC"),
      })
      .default({ timezone: "UTC" }),
    creativeFormat: z.enum(["SINGLE", "CAROUSEL"]).default("SINGLE"),
    creativeAssetIds: z.array(z.cuid()).min(1),
    copy: z.object({
      headline: z.string().min(1).max(255),
      primaryText: z.string().min(1).max(5000),
      description: z.string().max(1000).optional(),
      cta: z.string().min(1).max(80),
      destinationUrl: z.url(),
    }),
  })
  .superRefine((value, context) => {
    if (value.creativeFormat === "CAROUSEL") {
      if (value.platform !== "META")
        context.addIssue({
          code: "custom",
          path: ["creativeFormat"],
          message:
            "Native carousel publishing is currently supported for Meta campaigns",
        });
      if (value.creativeAssetIds.length < 2)
        context.addIssue({
          code: "custom",
          path: ["creativeAssetIds"],
          message: "Carousel campaigns require at least two creative assets",
        });
    }
  });

export const publishCampaignSchema = z.object({ campaignId: z.cuid() });
