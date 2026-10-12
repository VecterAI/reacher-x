import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  BLOG_AUTHOR_FALLBACK,
  BLOG_AUTHOR_USERNAME,
  resolveBlogAuthorProfile,
} from "./blogAuthorHelpers";

/**
 * Public author identity shared across pages, never keyed by visitor auth.
 *
 * At runtime a failed lookup rethrows so a background refresh never replaces
 * the last good cached profile; the uncached wrapper only falls back to the
 * static author when nothing is cached yet (cold start). During build-time
 * prerendering the failure is tolerated with a short-lived fallback entry so
 * deploys still succeed while the provider is down.
 */
export async function getBlogAuthor() {
  try {
    return await getCachedBlogAuthor();
  } catch {
    console.warn("[BlogAuthor] Profile lookup unavailable; using fallback");
    return BLOG_AUTHOR_FALLBACK;
  }
}

async function getCachedBlogAuthor() {
  "use cache";
  cacheLife("days");
  cacheTag("blog-author");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return BLOG_AUTHOR_FALLBACK;
  }
  const convex = new ConvexHttpClient(url, {
    logger: false,
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }),
  });
  // This existing anonymous action uses SocialAPI's dedicated profile endpoint.
  // Do not attach the visitor's auth: their follow relationship is irrelevant.
  try {
    const result = await convex.action(api.socialapi.getTwitterProfileDisplay, {
      username: BLOG_AUTHOR_USERNAME,
    });
    return resolveBlogAuthorProfile(result.profile);
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      cacheLife({ stale: 60, revalidate: 60, expire: 300 });
      return BLOG_AUTHOR_FALLBACK;
    }
    throw error;
  }
}
