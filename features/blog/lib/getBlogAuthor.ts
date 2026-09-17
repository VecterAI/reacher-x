import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  BLOG_AUTHOR_FALLBACK,
  BLOG_AUTHOR_USERNAME,
  resolveBlogAuthorProfile,
} from "./blogAuthorHelpers";

// Public author identity is shared across pages, never keyed by visitor auth.
export async function getBlogAuthor() {
  "use cache";
  cacheTag("blog-author");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    cacheLife("hours");
    return BLOG_AUTHOR_FALLBACK;
  }
  try {
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
    const result = await convex.action(api.socialapi.getTwitterProfileDisplay, {
      username: BLOG_AUTHOR_USERNAME,
    });
    const profile = resolveBlogAuthorProfile(result.profile);
    cacheLife("hours");
    return profile;
  } catch {
    cacheLife({ stale: 60, revalidate: 60, expire: 300 });
    console.warn("[BlogAuthor] Profile lookup unavailable; using fallback");
    return BLOG_AUTHOR_FALLBACK;
  }
}
