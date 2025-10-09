import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

const workosMiddleware = authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/",
      "/login",
      "/logout",
      "/callback",
      "/home",
      "/home/threads",
      "/home/threads/:threadId",
      "/workspace",
      "/onboarding",
      "/api/onboarding/complete",
      "/api/onboarding/status",
      "/search",
      "/settings",
      "/settings/linked-accounts",
      "/customers",
      "/replies",
      "/api/x/connect",
      "/api/x/callback",
      "/api/x/session",
      "/api/x/encrypt",
      "/post/:tweetId",
    ],
  },
});

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  const isRootPath = pathname === "/";
  let shouldSetOnboardingCookie = false;

  // Skip gating for any API routes
  if (pathname.startsWith("/api")) {
    const workosRes = await workosMiddleware(req, ev);
    return workosRes ?? NextResponse.next();
  }

  // Allow onboarding route itself
  const isOnboardingRoute =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  if (isOnboardingRoute) {
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

  // If cookie set, allow through (but still run WorkOS and preserve result)
  const cookieDone = req.cookies.get("rx_onb")?.value === "1";
  if (!cookieDone) {
    // Check server onboarding status for authenticated users; if done, set cookie and allow
    try {
      const statusUrl = new URL("/api/onboarding/status", req.url);
      const statusRes = await fetch(statusUrl, {
        headers: { cookie: req.headers.get("cookie") || "" },
      });
      if (statusRes.ok) {
        const data = (await statusRes.json()) as { done?: boolean };
        if (!data?.done) {
          // Redirect to onboarding
          const url = req.nextUrl.clone();
          url.pathname = isRootPath ? "/home" : "/onboarding";
          url.search = "";
          return NextResponse.redirect(url);
        } else {
          // Mark to set cookie on the response to avoid future status checks
          shouldSetOnboardingCookie = true;
        }
      } else {
        // If status check fails, err on the side of gating
        const url = req.nextUrl.clone();
        url.pathname = isRootPath ? "/home" : "/onboarding";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } catch {
      // Network/edge error: gate to onboarding
      const url = req.nextUrl.clone();
      url.pathname = isRootPath ? "/home" : "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Allowed: run WorkOS middleware and return its response (preserving cookie if needed)
  const workosRes = await workosMiddleware(req, ev);

  // Helper: ensure we can set cookie on the outgoing response even if WorkOS
  // returned a plain Response instead of NextResponse. If so, clone with header.
  function withOnboardingCookie(response: Response): Response {
    if (!shouldSetOnboardingCookie) return response;
    const secure = process.env.NODE_ENV === "production";
    const cookie = [
      "rx_onb=1",
      "Path=/",
      `Max-Age=${60 * 60 * 24 * 365}`,
      "HttpOnly",
      "SameSite=Lax",
      secure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    // If it's a NextResponse, prefer its cookies API
    if (response instanceof NextResponse) {
      try {
        response.cookies.set("rx_onb", "1", {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          httpOnly: true,
          sameSite: "lax",
          secure,
        });

        return response;
      } catch {
        // fall through to header approach
      }
    }

    // Fallback: clone response and append Set-Cookie header
    const headers = new Headers(response.headers);
    headers.append("Set-Cookie", cookie);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const baseRes = workosRes ?? NextResponse.next();
  const finalRes = withOnboardingCookie(baseRes);

  return finalRes;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
