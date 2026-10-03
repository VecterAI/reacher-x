import { authkit, handleAuthkitProxy } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { classifyBlogRoute } from "@/features/blog/lib/blogRouteCore";
import { publicMarkdownHref } from "@/features/landing/lib/agentReadinessHelpers";
import { BLOG_NOT_FOUND_HTML } from "@/features/blog/lib/blogNotFound";

import { isInvalidMarketingPath } from "@/features/landing/lib/marketingUseCaseHelpers";
import { publicNotFoundHtml } from "@/shared/lib/urls/publicNotFoundHelpers";

// Route handlers and static assets never render React, so they cannot reach
// the root layout's withAuth(). Skipping AuthKit on those paths keeps crawler
// and scanner traffic on these endpoints off authenticated compute. Pages
// (blog, home, pricing, post previews, the app) still run the full AuthKit
// flow because ConvexClientProvider reads AuthKit request headers.
const CONTENT_ONLY_PATH_PATTERNS = [
  /^\/markdown(?:\/.*)?$/,
  /^\/blog\/feed\.xml$/,
  /^\/blog\/sitemap\.md$/,
  /^\/blog\/[a-z0-9-]+\/(?:markdown|opengraph-image)$/,
  /^\/(?:sitemap\.xml|robots\.txt|llms\.txt)$/,
  /^\/blog-media\/reading-demo\.(?:mp4|vtt)$/,
  /^\/api\/(?:describe-url|opengraph|resolve-twitter-url)$/,
];

// Auth routes pass through to their route handlers, which build AuthKit URLs
// with a validated returnTo. Redirecting here instead would drop that intent.
const AUTH_PATH_PATTERNS = [
  /^\/login$/,
  /^\/signup$/,
  /^\/logout(?:\/complete)?$/,
  /^\/callback$/,
];

// Public pages pass through for anonymous visitors instead of redirecting to
// AuthKit. Content-only paths above skip the proxy entirely, so this list
// only gates page renders.
const PUBLIC_PATH_PATTERNS = [
  ...AUTH_PATH_PATTERNS,
  /^\/home(?:\/.*)?$/,
  /^\/pricing$/,
  /^\/blog(?:\/.*)?$/,
  /^\/post\/(?:x|linkedin)\/[^/]+$/,
];

function isContentOnlyPath(pathname: string) {
  return CONTENT_ONLY_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isInvalidMarketingPath(pathname)) {
    return new NextResponse(publicNotFoundHtml("marketing"), {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex",
        "Cache-Control": "no-store",
      },
    });
  }

  if (isContentOnlyPath(pathname)) {
    return NextResponse.next();
  }

  const { session, headers, authorizationUrl } = await authkit(request);

  const blogRoute = classifyBlogRoute(pathname);
  if (blogRoute) {
    const post = blogRoute.slug
      ? await (
          await import("@/features/blog/lib/blogPosts")
        ).getBlogPost(blogRoute.slug)
      : undefined;
    const emptyCategory = blogRoute.category
      ? !(
          await (await import("@/features/blog/lib/blogPosts")).getBlogPosts()
        ).some((item) => item.category === blogRoute.category)
      : false;
    if (
      blogRoute.kind === "invalid" ||
      emptyCategory ||
      (blogRoute.slug && !post)
    ) {
      // Set the status before React streams the shared authenticated shell.
      // notFound() alone otherwise produces a soft 404 under root Suspense.
      return new NextResponse(BLOG_NOT_FOUND_HTML, {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex",
          "Cache-Control": "no-store",
        },
      });
    }
  }

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

  const response = handleAuthkitProxy(request, headers);
  // Markdown lives at its dedicated /markdown URL; it is only advertised here,
  // never negotiated per Accept, so HTML responses stay cacheable.
  const markdownHref =
    blogRoute?.kind === "post"
      ? `${pathname}/markdown`
      : publicMarkdownHref(pathname);
  if (markdownHref) {
    response.headers.append(
      "Link",
      `<${markdownHref}>; rel="alternate"; type="text/markdown"`
    );
  }
  if (blogRoute?.kind === "listing" && request.nextUrl.searchParams.get("q"))
    response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}

export const config = {
  matcher: [
    // Blog URLs, including invalid file-like slugs, need the explicit 404 guard.
    "/blog/:path*",
    "/use-cases/:path*",
    "/home/:path*",
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
