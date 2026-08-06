import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Asset } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createDownloadUrl, getObjectBytes, putObject } from "@/server/storage";
import { assertPublicUrl } from "@/features/products/service";
import { recordCredits } from "@/server/credits";
import { generateTalkingAvatar } from "@/features/video/heygen";
import {
  publishCampaign,
  syncCampaignMetrics,
} from "@/features/campaigns/service";
import {
  campaignQueue,
  type CampaignJob,
  type GenerationJob,
} from "@/server/queue";

const config = env();
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
});
const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const ai = config.OPENAI_API_KEY
  ? new OpenAI({ apiKey: config.OPENAI_API_KEY })
  : undefined;

let remotionBundle: Promise<string> | undefined;

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-5000);
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}: ${stderr}`)),
    );
  });
}

async function imageJob(
  generation: Awaited<ReturnType<typeof db.generation.findUniqueOrThrow>>,
) {
  if (!ai) throw new Error("OPENAI_API_KEY is not configured");
  const options = generation.input as Record<string, unknown>;
  const sourceAssetId =
    typeof options.sourceAssetId === "string"
      ? options.sourceAssetId
      : undefined;
  const source = sourceAssetId
    ? await db.asset.findFirst({
        where: {
          id: sourceAssetId,
          organizationId: generation.organizationId,
          type: "IMAGE",
        },
      })
    : undefined;
  const instruction =
    generation.kind === "BACKGROUND_REMOVE"
      ? `${generation.prompt}\nIsolate the product precisely and remove the entire background. Preserve product geometry, label text, texture and shadows.`
      : generation.kind === "BACKGROUND_REPLACE"
        ? `${generation.prompt}\nReplace only the environment while preserving the product exactly.`
        : generation.kind === "PRODUCT_ENHANCE"
          ? `${generation.prompt}\nImprove lighting, sharpness and presentation without changing product design, labels or claims.`
          : generation.prompt;
  const format = String(options.format ?? "square");
  const size =
    format === "landscape"
      ? "1536x1024"
      : format === "portrait" || format === "story"
        ? "1024x1536"
        : "1024x1024";
  const result = source
    ? await ai.images.edit({
        model: config.OPENAI_IMAGE_MODEL,
        image: await toFile(
          await getObjectBytes(source.storageKey),
          "source.png",
          { type: source.mimeType },
        ),
        prompt: instruction,
        size,
        output_format: "png",
        input_fidelity: "high",
        background:
          generation.kind === "BACKGROUND_REMOVE" ? "transparent" : "auto",
      })
    : await ai.images.generate({
        model: config.OPENAI_IMAGE_MODEL,
        prompt: instruction,
        size,
        output_format: "png",
        background: "auto",
      });
  const encoded = result.data?.[0]?.b64_json;
  if (!encoded) throw new Error("Image provider returned no data");
  let body = Buffer.from(encoded, "base64");
  const template = options.template as Record<string, unknown> | undefined;
  const headline =
    typeof template?.headline === "string"
      ? template.headline.trim().slice(0, 90)
      : "";
  if (headline) {
    const metadata = await sharp(body).metadata();
    const width = metadata.width ?? 1024;
    const height = metadata.height ?? 1024;
    const color =
      typeof template?.brandColor === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(template.brandColor)
        ? template.brandColor
        : "#ff5a36";
    const margin = Math.max(
      16,
      Math.min(160, Number(template?.safeMargin ?? 48)),
    );
    const escaped = headline
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${margin}" y="${height - 210 - margin}" width="${width - margin * 2}" height="210" rx="26" fill="${color}"/><text x="${width / 2}" y="${height - 105 - margin}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial,sans-serif" font-size="54" font-weight="800">${escaped}</text></svg>`;
    body = await sharp(body)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }
  const logoAssetId =
    typeof template?.logoAssetId === "string"
      ? template.logoAssetId
      : undefined;
  if (logoAssetId) {
    const logo = await db.asset.findFirst({
      where: {
        id: logoAssetId,
        organizationId: generation.organizationId,
        type: "LOGO",
      },
    });
    if (!logo) throw new Error("Selected brand logo is unavailable");
    const metadata = await sharp(body).metadata();
    const width = metadata.width ?? 1024;
    const height = metadata.height ?? 1024;
    const margin = Math.max(
      16,
      Math.min(160, Number(template?.safeMargin ?? 48)),
    );
    const resized = await sharp(await getObjectBytes(logo.storageKey))
      .resize({
        width: Math.round(width * 0.22),
        height: Math.round(height * 0.1),
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    const position = String(template?.logoPosition ?? "top-left");
    const left = position.endsWith("right")
      ? width - resized.info.width - margin
      : margin;
    const top = position.startsWith("bottom")
      ? height - resized.info.height - margin
      : margin;
    body = await sharp(body)
      .composite([{ input: resized.data, left, top }])
      .png()
      .toBuffer();
  }
  return {
    body,
    contentType: "image/png",
    type: "IMAGE" as const,
    extension: "png",
  };
}

async function videoJob(
  generation: Awaited<ReturnType<typeof db.generation.findUniqueOrThrow>>,
) {
  const directory = await mkdtemp(join(tmpdir(), "adforge-render-"));
  try {
    const output = join(directory, "output.mp4");
    const options = generation.input as Record<string, unknown>;
    const requestedScenes: Array<
      Record<string, unknown> & {
        durationSeconds: number;
        script: string;
        caption?: string;
        transition?: string;
        backgroundAssetId?: string;
      }
    > =
      Array.isArray(options.scenes) && options.scenes.length
        ? options.scenes.map((value) => {
            const scene = value as Record<string, unknown>;
            return {
              ...scene,
              durationSeconds:
                typeof scene.durationSeconds === "number"
                  ? scene.durationSeconds
                  : 8,
              script:
                typeof scene.script === "string"
                  ? scene.script
                  : generation.prompt.slice(0, 160),
              caption:
                typeof scene.caption === "string" ? scene.caption : undefined,
              transition:
                typeof scene.transition === "string"
                  ? scene.transition
                  : "fade",
              backgroundAssetId:
                typeof scene.backgroundAssetId === "string"
                  ? scene.backgroundAssetId
                  : undefined,
            };
          })
        : [
            {
              durationSeconds: 8,
              script: generation.prompt.slice(0, 160),
              caption: String(options.caption ?? ""),
              transition: "fade",
            },
          ];
    const backgroundIds = requestedScenes
      .map((scene) => scene.backgroundAssetId)
      .filter((id): id is string => Boolean(id));
    const backgroundAssets = backgroundIds.length
      ? await db.asset.findMany({
          where: {
            id: { in: backgroundIds },
            organizationId: generation.organizationId,
            type: { in: ["IMAGE", "VIDEO"] },
          },
        })
      : [];
    if (backgroundAssets.length !== new Set(backgroundIds).size)
      throw new Error("One or more scene backgrounds are unavailable");
    const scenes = await Promise.all(
      requestedScenes.map(async (scene) => {
        const asset = backgroundAssets.find(
          (item) => item.id === scene.backgroundAssetId,
        );
        return {
          ...scene,
          ...(asset
            ? {
                background: await createDownloadUrl(asset.storageKey),
                backgroundType: asset.type,
              }
            : {}),
        };
      }),
    );
    const inputProps = {
      title: generation.prompt,
      format: options.format ?? "story",
      brand: options.brand ?? {
        primary: "#ff5a36",
        background: "#111827",
        foreground: "#ffffff",
      },
      scenes,
    };
    remotionBundle ??= bundle({
      entryPoint: join(process.cwd(), "src/remotion/index.ts"),
      webpackOverride: (configuration) => configuration,
    });
    const serveUrl = await remotionBundle;
    const composition = await selectComposition({
      serveUrl,
      id: "AdForgeVideo",
      inputProps,
      browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE,
    });
    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation: output,
      inputProps,
      browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE,
      onProgress: ({ progress }) => void progress,
    });
    let finalOutput = output;
    const voiceScript = inputProps.scenes
      .map((scene) => scene.script ?? "")
      .join("\n")
      .trim()
      .slice(0, 4096);
    if (ai && voiceScript) {
      const speech = await ai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "coral",
        input: voiceScript,
        instructions:
          "Natural, confident advertising voice. Conversational pacing; never sound exaggerated.",
      });
      const voicePath = join(directory, "voice.mp3");
      await writeFile(voicePath, Buffer.from(await speech.arrayBuffer()));
      const musicUrl =
        typeof options.musicUrl === "string" && options.musicUrl
          ? options.musicUrl
          : undefined;
      const mixed = join(directory, "final.mp4");
      if (musicUrl) {
        await assertPublicUrl(musicUrl);
        const response = await fetch(musicUrl, {
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        });
        if (
          !response.ok ||
          Number(response.headers.get("content-length") ?? 0) > 25_000_000
        )
          throw new Error("Licensed music could not be downloaded safely");
        const music = Buffer.from(await response.arrayBuffer());
        if (music.byteLength > 25_000_000)
          throw new Error("Licensed music exceeds 25 MB");
        const musicPath = join(directory, "music");
        await writeFile(musicPath, music);
        await run("ffmpeg", [
          "-y",
          "-i",
          output,
          "-i",
          voicePath,
          "-i",
          musicPath,
          "-filter_complex",
          "[1:a]volume=1.0[voice];[2:a]volume=0.14[music];[voice][music]amix=inputs=2:duration=first[audio]",
          "-map",
          "0:v:0",
          "-map",
          "[audio]",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-shortest",
          "-movflags",
          "+faststart",
          mixed,
        ]);
      } else
        await run("ffmpeg", [
          "-y",
          "-i",
          output,
          "-i",
          voicePath,
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-shortest",
          "-movflags",
          "+faststart",
          mixed,
        ]);
      finalOutput = mixed;
    }
    const body = await readFile(finalOutput);
    return {
      body,
      contentType: "video/mp4",
      type: "VIDEO" as const,
      extension: "mp4",
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function talkingAvatarJob(
  generation: Awaited<ReturnType<typeof db.generation.findUniqueOrThrow>>,
) {
  if (!config.HEYGEN_API_KEY)
    throw new Error("HEYGEN_API_KEY is not configured");
  const options = generation.input as Record<string, unknown>;
  const avatarId = typeof options.avatarId === "string" ? options.avatarId : "";
  const voiceId = typeof options.voiceId === "string" ? options.voiceId : "";
  if (!avatarId || !voiceId)
    throw new Error("Avatar and voice IDs are required");
  const scenes = Array.isArray(options.scenes)
    ? (options.scenes as Array<{ script?: string }>)
    : [];
  const script =
    scenes
      .map((scene) => scene.script ?? "")
      .filter(Boolean)
      .join("\n") || generation.prompt;
  const { body } = await generateTalkingAvatar(
    {
      avatarId,
      voiceId,
      script,
      format: String(options.format ?? "story"),
      title: `AdForge ${generation.id}`,
    },
    config.HEYGEN_API_KEY,
    {
      validateDownloadUrl: async (url) => {
        await assertPublicUrl(url);
      },
    },
  );
  return {
    body,
    contentType: "video/mp4",
    type: "VIDEO" as const,
    extension: "mp4",
  };
}

async function processGeneration(job: Job<GenerationJob>) {
  const generation = await db.generation.findFirstOrThrow({
    where: {
      id: job.data.generationId,
      organizationId: job.data.organizationId,
    },
  });
  if (generation.status === "SUCCEEDED") return generation;
  await db.generation.update({
    where: { id: generation.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });
  try {
    const isVideo =
      generation.kind.includes("VIDEO") ||
      ["SLIDESHOW", "TALKING_AVATAR", "PRODUCT_SHOWCASE"].includes(
        generation.kind,
      );
    const outputs = [];
    if (generation.kind === "CAROUSEL") {
      const options = generation.input as Record<string, unknown>;
      const slides = options.carouselSlides as Array<{
        headline: string;
        prompt: string;
      }>;
      for (const [position, slide] of slides.entries()) {
        const template = (options.template as Record<string, unknown>) ?? {};
        const slideGeneration = {
          ...generation,
          prompt: slide.prompt,
          input: {
            ...options,
            format: "square",
            template: { ...template, headline: slide.headline },
          },
        } as unknown as typeof generation;
        outputs.push({ ...(await imageJob(slideGeneration)), position });
      }
    } else {
      const output = isVideo
        ? generation.kind === "TALKING_AVATAR"
          ? await talkingAvatarJob(generation)
          : await videoJob(generation)
        : await imageJob(generation);
      outputs.push({ ...output, position: 0 });
    }
    const assets: Asset[] = [];
    for (const output of outputs) {
      const suffix = outputs.length > 1 ? `-${output.position + 1}` : "";
      const storageKey = `organizations/${generation.organizationId}/generations/${generation.id}${suffix}.${output.extension}`;
      await putObject(storageKey, output.body, output.contentType);
      assets.push(
        await db.asset.upsert({
          where: { storageKey },
          update: {
            bytes: output.body.byteLength,
            mimeType: output.contentType,
          },
          create: {
            organizationId: generation.organizationId,
            projectId: generation.projectId,
            type: output.type,
            name: `${generation.kind.toLowerCase()}-${generation.id}${suffix}`,
            storageKey,
            url: `s3://${config.S3_BUCKET}/${storageKey}`,
            mimeType: output.contentType,
            bytes: output.body.byteLength,
            metadata: {
              generationId: generation.id,
              ...(outputs.length > 1
                ? { carouselPosition: output.position }
                : {}),
            },
          },
        }),
      );
    }
    const asset = assets[0]!;
    const completed = await db.$transaction(async (tx) => {
      const current = await tx.generation.findUniqueOrThrow({
        where: { id: generation.id },
      });
      if (current.status === "SUCCEEDED") return current;
      const result = await tx.generation.update({
        where: { id: generation.id },
        data: {
          status: "SUCCEEDED",
          outputAssetId: asset.id,
          output: {
            assetId: asset.id,
            assetIds: assets.map((item) => item.id),
          },
          errorCode: null,
          errorMessage: null,
          completedAt: new Date(),
        },
      });
      await tx.usageRecord.create({
        data: {
          organizationId: generation.organizationId,
          metric: generation.kind.toLowerCase(),
          quantity: 1,
          unit: "generation",
          metadata: {
            generationId: generation.id,
            assetId: asset.id,
            assetIds: assets.map((item) => item.id),
          },
        },
      });
      await tx.notification.create({
        data: {
          organizationId: generation.organizationId,
          userId: generation.userId,
          type: "GENERATION",
          title: `${generation.kind.replaceAll("_", " ")} ready`,
          message:
            assets.length > 1
              ? `${assets.length} carousel cards are ready to use in a campaign.`
              : "Your generated asset is ready to review and use in a campaign.",
          actionUrl: generation.kind.includes("VIDEO")
            ? "/video-studio"
            : "/image-studio",
        },
      });
      return result;
    });
    return completed;
  } catch (error) {
    const finalAttempt =
      job.attemptsMade + 1 >= Math.max(1, job.opts.attempts ?? 1);
    if (!finalAttempt) {
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: "QUEUED",
          errorCode: "RETRY_SCHEDULED",
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : "Render retry scheduled",
        },
      });
      throw error;
    }
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: "FAILED",
        errorCode: "RENDER_FAILED",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Render failed",
        completedAt: new Date(),
      },
    });
    await recordCredits({
      organizationId: generation.organizationId,
      amount: generation.creditsCharged,
      type: "REFUND",
      description: `Refund for failed ${generation.kind}`,
      referenceId: generation.id,
    });
    await db.notification.create({
      data: {
        organizationId: generation.organizationId,
        userId: generation.userId,
        type: "ERROR",
        title: `${generation.kind.replaceAll("_", " ")} failed`,
        message:
          "The generation did not complete and its credits were refunded.",
        actionUrl: "/dashboard",
      },
    });
    throw error;
  }
}

const generationWorker = new Worker<GenerationJob>(
  "generations",
  processGeneration,
  { connection, concurrency: 2, limiter: { max: 10, duration: 60_000 } },
);
const campaignWorker = new Worker<CampaignJob>(
  "campaigns",
  async (job) => {
    try {
      if (job.data.action === "publish") {
        const campaign = await publishCampaign(
          job.data.campaignId,
          job.data.organizationId,
        );
        await db.notification.create({
          data: {
            organizationId: campaign.organizationId,
            userId: campaign.createdById,
            type: "CAMPAIGN",
            title: `${campaign.name} published`,
            message: `${campaign.platform} accepted the campaign in ${campaign.status.toLowerCase()} state.`,
            actionUrl: "/campaigns",
          },
        });
        return campaign;
      }
      return syncCampaignMetrics(job.data.campaignId, job.data.organizationId);
    } catch (error) {
      const finalAttempt =
        job.attemptsMade + 1 >= Math.max(1, job.opts.attempts ?? 1);
      if (job.data.action === "publish" && finalAttempt) {
        const campaign = await db.campaign
          .update({
            where: { id: job.data.campaignId },
            data: { status: "FAILED" },
          })
          .catch(() => null);
        if (campaign)
          await db.notification.create({
            data: {
              organizationId: campaign.organizationId,
              userId: campaign.createdById,
              type: "ERROR",
              title: `${campaign.name} could not publish`,
              message:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : "The advertising platform rejected the campaign.",
              actionUrl: "/campaigns",
            },
          });
      }
      throw error;
    }
  },
  { connection, concurrency: 5, limiter: { max: 50, duration: 60_000 } },
);

async function enqueueMetricSync() {
  const campaigns = await db.campaign.findMany({
    where: {
      status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] },
      externalId: { not: null },
      adConnectionId: { not: null },
    },
    select: { id: true, organizationId: true },
  });
  const bucket = new Date().toISOString().slice(0, 13);
  await Promise.all(
    campaigns.map((campaign) =>
      campaignQueue.add(
        "sync-metrics",
        {
          campaignId: campaign.id,
          organizationId: campaign.organizationId,
          action: "sync-metrics",
        },
        { jobId: `metrics-${campaign.id}-${bucket}` },
      ),
    ),
  );
}
void enqueueMetricSync().catch((error) =>
  logger.error({ error }, "Initial metric scheduling failed"),
);
setInterval(
  () =>
    void enqueueMetricSync().catch((error) =>
      logger.error({ error }, "Metric scheduling failed"),
    ),
  15 * 60_000,
).unref();

for (const worker of [generationWorker, campaignWorker]) {
  worker.on("completed", (job) =>
    logger.info({ jobId: job.id, queue: worker.name }, "Job completed"),
  );
  worker.on("failed", (job, error) =>
    logger.error({ jobId: job?.id, queue: worker.name, error }, "Job failed"),
  );
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down");
  await Promise.all([generationWorker.close(), campaignWorker.close()]);
  await connection.quit();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
