import Redis from "ioredis";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

let client: Redis | undefined;
function redis() {
  return (client ??= new Redis(env().REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  }));
}

export async function rateLimit(key: string, limit = 60, windowSeconds = 60) {
  const bucket = `ratelimit:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  try {
    const count = await redis().incr(bucket);
    if (count === 1) await redis().expire(bucket, windowSeconds + 1);
    if (count > limit)
      throw new AppError("Rate limit exceeded", "RATE_LIMITED", 429, {
        retryAfter: windowSeconds,
      });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (env().NODE_ENV === "production")
      throw new AppError(
        "Rate limiter unavailable",
        "SERVICE_UNAVAILABLE",
        503,
      );
  }
}
