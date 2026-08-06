import { db } from "@/lib/db";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET() {
  const started = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return ok({
      status: "healthy",
      version: process.env.npm_package_version ?? "1.0.0",
      database: "up",
      latencyMs: Math.round(performance.now() - started),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        data: {
          status: "unhealthy",
          database: "down",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 503 },
    );
  }
}
