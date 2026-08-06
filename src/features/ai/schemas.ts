import { z } from "zod";

export const aiKinds = [
  "HEADLINE",
  "PRIMARY_TEXT",
  "CTA",
  "DESCRIPTION",
  "EMAIL",
  "LANDING_PAGE",
  "BLOG",
  "SEO",
  "CREATIVE_IDEA",
  "AUDIENCE",
  "HOOK",
  "OFFER",
  "IMAGE_PROMPT",
  "VIDEO_SCRIPT",
  "VOICEOVER",
  "CAPTION",
] as const;
export const generateCopySchema = z.object({
  projectId: z.cuid(),
  productId: z.cuid().optional(),
  kind: z.enum(aiKinds),
  brief: z.string().min(10).max(8000),
  audience: z.string().min(2).max(1000),
  tone: z.string().min(2).max(100),
  language: z.string().min(2).max(10).default("en"),
  variants: z.number().int().min(1).max(10).default(3),
});

export const generateMediaSchema = z
  .object({
    projectId: z.cuid(),
    productId: z.cuid().optional(),
    kind: z.enum([
      "IMAGE",
      "VIDEO",
      "BACKGROUND_REMOVE",
      "BACKGROUND_REPLACE",
      "PRODUCT_ENHANCE",
      "LIFESTYLE",
      "CAROUSEL",
      "UGC_VIDEO",
      "SLIDESHOW",
      "TALKING_AVATAR",
      "PRODUCT_SHOWCASE",
    ]),
    prompt: z.string().min(10).max(8000),
    options: z
      .object({
        format: z
          .enum(["square", "portrait", "landscape", "story"])
          .default("square"),
        sourceAssetId: z.cuid().optional(),
        template: z
          .object({
            headline: z.string().max(90).default(""),
            brandColor: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/)
              .default("#ff5a36"),
            fontFamily: z
              .enum(["Inter", "Arial", "Georgia", "Helvetica"])
              .default("Inter"),
            logoPosition: z
              .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
              .default("top-left"),
            logoAssetId: z.cuid().optional(),
            safeMargin: z.number().int().min(16).max(160).default(48),
          })
          .optional(),
        scenes: z
          .array(
            z.object({
              id: z.string().max(100).optional(),
              durationSeconds: z.number().min(1).max(30),
              script: z.string().min(1).max(500),
              caption: z.string().max(200).optional(),
              transition: z.enum(["fade", "slide", "zoom"]).default("fade"),
              backgroundAssetId: z.cuid().optional(),
            }),
          )
          .min(1)
          .max(20)
          .optional(),
        musicUrl: z.url().optional().or(z.literal("")),
        avatarId: z.string().min(1).max(200).optional(),
        voiceId: z.string().min(1).max(200).optional(),
        carouselSlides: z
          .array(
            z.object({
              headline: z.string().min(1).max(90),
              prompt: z.string().min(5).max(1000),
            }),
          )
          .min(2)
          .max(10)
          .optional(),
      })
      .default({ format: "square" }),
  })
  .superRefine((value, context) => {
    if (
      ["BACKGROUND_REMOVE", "BACKGROUND_REPLACE", "PRODUCT_ENHANCE"].includes(
        value.kind,
      ) &&
      !value.options.sourceAssetId
    )
      context.addIssue({
        code: "custom",
        path: ["options", "sourceAssetId"],
        message: "A source image is required for this transformation",
      });
    if (value.kind === "TALKING_AVATAR") {
      if (!value.options.avatarId)
        context.addIssue({
          code: "custom",
          path: ["options", "avatarId"],
          message: "A HeyGen avatar ID is required",
        });
      if (!value.options.voiceId)
        context.addIssue({
          code: "custom",
          path: ["options", "voiceId"],
          message: "A HeyGen voice ID is required",
        });
    }
    if (value.kind === "CAROUSEL" && !value.options.carouselSlides)
      context.addIssue({
        code: "custom",
        path: ["options", "carouselSlides"],
        message: "Carousel ads require two to ten slides",
      });
  });
