import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  BLOG_AUTHOR_FALLBACK,
  BLOG_AUTHOR_USERNAME,
  resolveBlogAuthorProfile,
} from "./blogAuthorHelpers";

// React cache deduplicates within one render request; it does not cache across visits.
export const getBlogAuthor = cache(async () => {
  await connection();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return BLOG_AUTHOR_FALLBACK;
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
    return resolveBlogAuthorProfile(result.profile);
  } catch {
    console.warn("[BlogAuthor] Profile lookup unavailable; using fallback");
    return BLOG_AUTHOR_FALLBACK;
  }
});
