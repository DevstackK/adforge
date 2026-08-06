import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1/health",
  "/api/v1/openapi",
  "/api/webhooks/(.*)",
]);

const protectedMiddleware = clerkMiddleware(async (auth) => {
  await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isPublic(request)) return NextResponse.next();
  if (
    request.nextUrl.pathname.startsWith("/api/v1/") &&
    request.headers.get("authorization")?.startsWith("Bearer af_")
  ) {
    return NextResponse.next();
  }
  return protectedMiddleware(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
