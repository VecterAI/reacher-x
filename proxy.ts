import { authkit, handleAuthkitProxy } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";

const PUBLIC_PATH_PATTERNS = [
  /^\/login$/,
  /^\/logout$/,
  /^\/callback$/,
  /^\/home(?:\/.*)?$/,
  /^\/threads(?:\/.*)?$/,
  /^\/use-cases$/,
  /^\/pricing$/,
  /^\/api\/describe-url$/,
  /^\/api\/opengraph$/,
  /^\/api\/resolve-twitter-url$/,
  /^\/post\/x\/[^/]+$/,
  /^\/post\/linkedin\/[^/]+$/,
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export async function proxy(request: NextRequest) {
  const { session, headers, authorizationUrl } = await authkit(request);
  const { pathname, search } = request.nextUrl;

  if (pathname === "/" && !session.user) {
    const homeUrl = new URL("/home", request.url);
    homeUrl.search = search;
    return handleAuthkitProxy(request, headers, { redirect: homeUrl });
  }

  if (!isPublicPath(pathname) && !session.user && authorizationUrl) {
    return handleAuthkitProxy(request, headers, {
      redirect: authorizationUrl,
    });
  }

  return handleAuthkitProxy(request, headers);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
