import { ConvexHttpClient } from "convex/browser";
import { unstable_cache } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Tweet } from "@/features/threads/types";
import { MOCK_PUBLIC_TESTIMONIALS } from "@/features/landing/lib/mockPublicTestimonials";
import { logger } from "@/shared/lib/logger";

const PUBLIC_TESTIMONIALS_REVALIDATE_SECONDS = 60 * 5;

function shouldUseMockTestimonials() {
  return (
    process.env.LANDING_USE_MOCK_TESTIMONIALS === "1" ||
    process.env.NODE_ENV === "development"
  );
}

function withMockFallback(tweets: Tweet[], limit: number): Tweet[] {
  if (tweets.length > 0) {
    return tweets.slice(0, limit);
  }
  if (!shouldUseMockTestimonials()) {
    return [];
  }
  return MOCK_PUBLIC_TESTIMONIALS.slice(0, limit);
}

const getCachedPublicTestimonials = unstable_cache(
  async (limit: number) => {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
      return withMockFallback([], limit);
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL, {
      logger: false,
    });

    try {
      const response = await convex.action(
        api.publicSocial.getPublicTestimonials,
        {
          limit,
        }
      );
      return withMockFallback(response.tweets as Tweet[], limit);
    } catch (error) {
      logger.error(
        "[getPublicTestimonials] Failed to fetch public testimonials",
        error
      );
      return withMockFallback([], limit);
    }
  },
  ["public-testimonials-x-api-v3"],
  {
    revalidate: PUBLIC_TESTIMONIALS_REVALIDATE_SECONDS,
  }
);

export async function getPublicTestimonials(limit = 4) {
  return await getCachedPublicTestimonials(limit);
}
