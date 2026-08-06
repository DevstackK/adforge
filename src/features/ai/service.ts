import "server-only";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, NotFoundError } from "@/lib/errors";
import { recordCredits } from "@/server/credits";
import { generationQueue } from "@/server/queue";
import type { z } from "zod";
import type { generateCopySchema, generateMediaSchema } from "./schemas";
import type { Prisma } from "@/generated/prisma/client";
import { isFeatureEnabled } from "@/server/features";

let client: OpenAI | undefined;
function openai() {
  if (!env().OPENAI_API_KEY)
    throw new AppError(
      "AI provider is not configured",
      "AI_NOT_CONFIGURED",
      503,
    );
  return (client ??= new OpenAI({
    apiKey: env().OPENAI_API_KEY,
    timeout: 90_000,
    maxRetries: 2,
  }));
}

const copyCredits: Record<string, number> = {
  BLOG: 4,
  LANDING_PAGE: 3,
  EMAIL: 2,
};

export async function generateCopy(
  input: z.infer<typeof generateCopySchema> & {
    organizationId: string;
    userId: string;
  },
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, organizationId: input.organizationId },
  });
  if (!project) throw new NotFoundError("Project");
  const cost = copyCredits[input.kind] ?? 1;
  const generation = await db.generation.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      productId: input.productId,
      userId: input.userId,
      kind: input.kind,
      provider: "openai",
      model: env().OPENAI_TEXT_MODEL,
      status: "PROCESSING",
      prompt: input.brief,
      input,
      creditsCharged: cost,
      startedAt: new Date(),
    },
  });
  try {
    await recordCredits({
      organizationId: input.organizationId,
      amount: -cost,
      type: "USAGE",
      description: `${input.kind} generation`,
      referenceId: generation.id,
    });
    const result = await openai().responses.create({
      model: env().OPENAI_TEXT_MODEL,
      input: [
        {
          role: "developer",
          content: `You are AdForge's senior advertising strategist. Return JSON only as {"variants":[{"content":"...","rationale":"...","score":0-100}]}. Produce exactly ${input.variants} distinct, truthful, platform-safe variants in ${input.language}. Never invent product claims.`,
        },
        {
          role: "user",
          content: `Asset type: ${input.kind}\nAudience: ${input.audience}\nTone: ${input.tone}\nBrief:\n${input.brief}`,
        },
      ],
      text: { format: { type: "json_object" } },
    });
    const parsed = JSON.parse(result.output_text) as {
      variants: Array<{ content: string; rationale?: string; score?: number }>;
    };
    if (!Array.isArray(parsed.variants) || !parsed.variants.length)
      throw new Error("AI returned no variants");
    const variants = await db.$transaction(async (tx) => {
      const created = await Promise.all(
        parsed.variants.slice(0, input.variants).map((variant) =>
          tx.copyVariant.create({
            data: {
              projectId: input.projectId,
              generationId: generation.id,
              type: input.kind,
              content: variant.content,
              language: input.language,
              score: variant.score,
              metadata: { rationale: variant.rationale },
            },
          }),
        ),
      );
      await tx.generation.update({
        where: { id: generation.id },
        data: {
          status: "SUCCEEDED",
          output: { count: created.length },
          completedAt: new Date(),
        },
      });
      await tx.usageRecord.create({
        data: {
          organizationId: input.organizationId,
          metric: input.kind.toLowerCase(),
          quantity: 1,
          unit: "generation",
          metadata: { generationId: generation.id, variants: created.length },
        },
      });
      await tx.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          type: "GENERATION",
          title: `${input.kind.replaceAll("_", " ")} copy ready`,
          message: `${created.length} copy variants are ready to review.`,
          actionUrl: "/copy-studio",
        },
      });
      return created;
    });
    return { generationId: generation.id, variants };
  } catch (error) {
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: "FAILED",
        errorCode: "PROVIDER_ERROR",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Generation failed",
        completedAt: new Date(),
      },
    });
    await recordCredits({
      organizationId: input.organizationId,
      amount: cost,
      type: "REFUND",
      description: `Refund for failed ${input.kind} generation`,
      referenceId: generation.id,
    });
    throw error;
  }
}

export async function enqueueMedia(
  input: z.infer<typeof generateMediaSchema> & {
    organizationId: string;
    userId: string;
  },
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, organizationId: input.organizationId },
  });
  if (!project) throw new NotFoundError("Project");
  const requestedAssetIds = [
    input.options.sourceAssetId,
    input.options.template?.logoAssetId,
    ...(input.options.scenes?.map((scene) => scene.backgroundAssetId) ?? []),
  ].filter((value): value is string => Boolean(value));
  if (requestedAssetIds.length) {
    const accessible = await db.asset.count({
      where: {
        id: { in: requestedAssetIds },
        organizationId: input.organizationId,
      },
    });
    if (accessible !== new Set(requestedAssetIds).size)
      throw new AppError(
        "One or more source assets are unavailable",
        "INVALID_SOURCE_ASSET",
        422,
      );
  }
  const isVideo =
    input.kind.includes("VIDEO") ||
    ["SLIDESHOW", "TALKING_AVATAR", "PRODUCT_SHOWCASE"].includes(input.kind);
  if (input.kind === "TALKING_AVATAR" && !env().HEYGEN_API_KEY)
    throw new AppError(
      "Talking-avatar provider is not configured",
      "AVATAR_PROVIDER_NOT_CONFIGURED",
      503,
    );
  if (
    input.kind === "TALKING_AVATAR" &&
    !(await isFeatureEnabled("talking-avatar", input.organizationId))
  )
    throw new AppError(
      "Talking-avatar generation is not enabled for this organization",
      "FEATURE_DISABLED",
      403,
    );
  const cost =
    input.kind === "CAROUSEL"
      ? 5 * (input.options.carouselSlides?.length ?? 1)
      : isVideo
        ? 25
        : 5;
  const generation = await db.generation.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      productId: input.productId,
      userId: input.userId,
      kind: input.kind,
      provider: input.kind === "TALKING_AVATAR" ? "heygen" : "openai",
      model:
        input.kind === "TALKING_AVATAR"
          ? "heygen-avatar-v2"
          : isVideo
            ? "remotion-ffmpeg"
            : env().OPENAI_IMAGE_MODEL,
      prompt: input.prompt,
      input: input.options as Prisma.InputJsonValue,
      creditsCharged: cost,
    },
  });
  let charged = false;
  try {
    await recordCredits({
      organizationId: input.organizationId,
      amount: -cost,
      type: "USAGE",
      description: `${input.kind} generation`,
      referenceId: generation.id,
    });
    charged = true;
    await generationQueue.add(
      input.kind.toLowerCase(),
      { generationId: generation.id, organizationId: input.organizationId },
      { jobId: generation.id },
    );
    return generation;
  } catch (error) {
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: "FAILED",
        errorCode: "QUEUE_ERROR",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Queue unavailable",
        completedAt: new Date(),
      },
    });
    if (charged)
      await recordCredits({
        organizationId: input.organizationId,
        amount: cost,
        type: "REFUND",
        description: `Refund for unqueued ${input.kind} generation`,
        referenceId: generation.id,
      });
    throw error;
  }
}
