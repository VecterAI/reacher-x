import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

const workosMiddleware = authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/login",
      "/logout",
      "/callback",
      "/home",
      "/home/threads",
      "/home/threads/:threadId",
      "/api/describe-url",
      "/api/opengraph",
      "/post/x/:id",
      "/post/linkedin/:id",
    ],
  },
});

export async function proxy(req: NextRequest, ev: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  // Skip gating for any API routes
  if (pathname.startsWith("/api")) {
    const workosRes = await workosMiddleware(req, ev);
    return workosRes ?? NextResponse.next();
  }

  // Allow public landing pages (e.g., /home and its subroutes)
  const isLandingRoute = pathname === "/home" || pathname.startsWith("/home/");
  if (isLandingRoute) {
    const workosRes = await workosMiddleware(req, ev);
    return workosRes ?? NextResponse.next();
  }

  // Allow WorkOS auth routes to proceed without onboarding gating so login works
  const isAuthRoute =
    pathname === "/login" || pathname === "/callback" || pathname === "/logout";
  if (isAuthRoute) {
    const workosRes = await workosMiddleware(req, ev);
    return workosRes ?? NextResponse.next();
  }

  // Allowed: run WorkOS middleware and return its response
  const workosRes = await workosMiddleware(req, ev);
  return workosRes ?? NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
