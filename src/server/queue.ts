import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";

export type GenerationJob = { generationId: string; organizationId: string };
export type CampaignJob = {
  campaignId: string;
  organizationId: string;
  action: "publish" | "sync-metrics";
};

const globalQueues = globalThis as unknown as {
  generationQueue?: Queue<GenerationJob>;
  campaignQueue?: Queue<CampaignJob>;
};
function connection() {
  return new IORedis(env().REDIS_URL, { maxRetriesPerRequest: null });
}

export const generationQueue =
  globalQueues.generationQueue ??
  new Queue<GenerationJob>("generations", {
    connection: connection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });
export const campaignQueue =
  globalQueues.campaignQueue ??
  new Queue<CampaignJob>("campaigns", {
    connection: connection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 2000,
    },
  });

if (env().NODE_ENV !== "production") {
  globalQueues.generationQueue = generationQueue;
  globalQueues.campaignQueue = campaignQueue;
}
