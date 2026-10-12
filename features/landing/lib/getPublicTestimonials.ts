import { ConvexHttpClient } from "convex/browser";
import { cacheLife, cacheTag } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Tweet } from "@/features/threads/types";
import { MOCK_PUBLIC_TESTIMONIALS } from "@/features/landing/lib/mockPublicTestimonials";

function shouldUseMockTestimonials() {
  return (
    process.env.LANDING_USE_MOCK_TESTIMONIALS === "1" ||
    process.env.NODE_ENV === "development"
  );
}

/**
 * Curated public feed for the landing page.
 *
 * Provider failures are swallowed inside the Convex action and come back as an
 * empty success, so the cached lookup treats an empty result as unavailable
 * and rethrows at runtime: a failed background refresh never replaces the last
 * good cached set. The uncached wrapper only hides the section when nothing is
 * cached yet (cold start). During build-time prerendering the failure is
 * tolerated with a short-lived empty entry so deploys still succeed while the
 * provider is down.
 */
export async function getPublicTestimonials(limit = 4): Promise<Tweet[]> {
  if (shouldUseMockTestimonials()) {
    return MOCK_PUBLIC_TESTIMONIALS.slice(0, limit);
  }
  try {
    return await getCachedPublicTestimonials(limit);
  } catch {
    return [];
  }
}

async function getCachedPublicTestimonials(limit: number): Promise<Tweet[]> {
  "use cache";
  cacheLife("days");
  cacheTag("public-testimonials");

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return [];
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

  try {
    const response = await convex.action(
      api.publicSocial.getPublicTestimonials,
      {
        limit,
      }
    );
    const tweets = response.tweets as Tweet[];
    if (tweets.length === 0) {
      throw new Error("Public testimonials unavailable");
    }
    return tweets.slice(0, limit);
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      cacheLife({ stale: 60, revalidate: 60, expire: 300 });
      return [];
    }
    throw error;
  }
}
