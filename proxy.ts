import {
  authkit,
  handleAuthkitProxy,
  partitionAuthkitHeaders,
  applyResponseHeaders,
} from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import {
  classifyBlogRoute,
  prefersBlogMarkdown,
} from "@/features/blog/lib/blogRouteCore";
import { BLOG_NOT_FOUND_HTML } from "@/features/blog/lib/blogNotFound";

const PUBLIC_PATH_PATTERNS = [
  /^\/login$/,
  /^\/signup$/,
  /^\/logout(?:\/complete)?$/,
  /^\/callback$/,
  /^\/home(?:\/.*)?$/,
  /^\/threads(?:\/.*)?$/,
  /^\/use-cases$/,
  /^\/pricing$/,
  /^\/blog(?:\/.*)?$/,
  /^\/blog-media\/(?:reading-demo\.(?:mp4|vtt)|reacherx-v3\/[a-z-]+\.mp4)$/,
  /^\/(?:sitemap\.xml|robots\.txt|llms\.txt)$/,
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
    const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
      request,
      headers
    );
    if (
      blogRoute.kind === "invalid" ||
      emptyCategory ||
      (blogRoute.slug && !post)
    ) {
      // Set the status before React streams the shared authenticated shell.
      // notFound() alone otherwise produces a soft 404 under root Suspense.
      return applyResponseHeaders(
        new NextResponse(BLOG_NOT_FOUND_HTML, {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "X-Robots-Tag": "noindex",
            "Cache-Control": "no-store",
          },
        }),
        responseHeaders
      );
    }
    if (
      blogRoute.kind === "post" &&
      prefersBlogMarkdown(request.headers.get("accept") ?? "")
    ) {
      const response = applyResponseHeaders(
        NextResponse.rewrite(new URL(`${pathname}/markdown`, request.url), {
          request: { headers: requestHeaders },
        }),
        responseHeaders
      );
      response.headers.append("Vary", "Accept");
      return response;
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
  if (blogRoute?.kind === "post") response.headers.append("Vary", "Accept");
  if (blogRoute?.kind === "listing" && request.nextUrl.searchParams.get("q"))
    response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}

export const config = {
  matcher: [
    // Blog URLs, including invalid file-like slugs, need the explicit 404 guard.
    "/blog/:path*",
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
