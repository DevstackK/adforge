import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function ok<T>(data: T, init?: ResponseInit) {
  const safe = JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as T;
  return NextResponse.json({ data: safe }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function routeError(error: unknown, requestId = crypto.randomUUID()) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
          requestId,
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.status },
    );
  }
  logger.error({ error, requestId }, "Unhandled route error");
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId,
      },
    },
    { status: 500 },
  );
}

export async function parseJson<T>(
  request: Request,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    throw new AppError(
      "Content-Type must be application/json",
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new AppError(
      "Cross-origin state changes are not allowed",
      "CSRF_REJECTED",
      403,
    );
  return schema.parse(await request.json());
}
